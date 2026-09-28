/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Aprovações: o admin analisa as alterações pedidas pelos corretores; o corretor acompanha as suas. */
import { supabase } from '../../shared/supabase-client.js';
import { alertBox, emptyState, errorMessage, esc, formatDateTime, memberName, routeQuery } from '../lib/ui.js';
import { changeRequestsRepository } from '../repositories/change-requests.js';
import { describeChanges } from './properties.js';

const STATUS_LABELS = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Rejeitada', cancelled: 'Cancelada' };
const STATUS_BADGES = { pending: 'badge-gold', approved: 'badge-green', rejected: '', cancelled: '' };

export async function approvalsPage(view, ctx) {
  const status = routeQuery().get('status') ?? 'pending';
  const requests = await changeRequestsRepository.list(ctx.agency.id, { status });
  const propertyIds = [...new Set(requests.filter((request) => request.entity === 'property').map((request) => request.entity_id))];
  const { data: properties, error } = propertyIds.length
    ? await supabase.from('properties').select('*').in('id', propertyIds)
    : { data: [], error: null };
  if (error) throw error;
  const byId = new Map(properties.map((property) => [property.id, property]));

  const items = requests.map((request) => {
    const property = byId.get(request.entity_id);
    const target = request.entity === 'property'
      ? property ? `<a href="#/imoveis/${property.id}">${esc(property.code)} · ${esc(property.title)}</a>` : 'Imóvel removido'
      : `<a href="#/proprietarios/${request.entity_id}">Proprietário</a>`;
    const actions = request.status !== 'pending' ? ''
      : ctx.isAdmin
        ? `<div class="field"><label for="note-${request.id}">Observação (opcional)</label><input id="note-${request.id}" name="note" maxlength="1000"></div><div class="pending-actions"><button class="btn btn-primary" type="button" data-approve>Aprovar</button><button class="btn btn-secondary" type="button" data-reject>Rejeitar</button></div>`
        : '<div class="pending-actions"><button class="btn btn-secondary" type="button" data-cancel>Cancelar solicitação</button></div>';
    const review = request.reviewed_at ? `<p class="muted">${STATUS_LABELS[request.status]} por ${esc(memberName(ctx.team, request.reviewed_by))} em ${formatDateTime(request.reviewed_at)}${request.review_note ? ` · ${esc(request.review_note)}` : ''}</p>` : '';
    return `<article class="card request-card" data-request="${request.id}"><div class="request-head"><div><h2>${target}</h2><p class="muted">${esc(memberName(ctx.team, request.requested_by))} · ${formatDateTime(request.requested_at)}${request.reason ? ` · “${esc(request.reason)}”` : ''}</p></div><span class="badge ${STATUS_BADGES[request.status]}">${STATUS_LABELS[request.status]}</span></div><ul class="change-list">${request.entity === 'property' ? describeChanges(request, property, ctx.team) : esc(JSON.stringify(request.payload))}</ul>${review}${actions}</article>`;
  }).join('');

  const tabs = [['pending', 'Pendentes'], ['approved', 'Aprovadas'], ['rejected', 'Rejeitadas'], ['', 'Todas']]
    .map(([value, label]) => `<a class="tab${value === status ? ' active' : ''}" href="#/aprovacoes${value === 'pending' ? '' : `?status=${value}`}">${label}</a>`).join('');

  view.innerHTML = `<header class="page-header"><div><h1>${ctx.isAdmin ? 'Aprovações' : 'Minhas solicitações'}</h1><p class="muted">${ctx.isAdmin ? 'Alterações pedidas pelos corretores em preço, publicação, situação e responsáveis.' : 'Alterações que você enviou para aprovação do administrador.'}</p></div></header>
    ${ctx.takeFlash()}<div data-feedback></div><nav class="tabs">${tabs}</nav>
    ${requests.length ? items : emptyState(status === 'pending' ? 'Nenhuma solicitação pendente.' : 'Nenhuma solicitação.')}`;

  const feedback = view.querySelector('[data-feedback]');
  view.querySelectorAll('[data-request]').forEach((card) => {
    const id = card.dataset.request;
    const run = async (action, message) => {
      card.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      try {
        await action();
        ctx.flash(message);
        await ctx.refreshBadges();
        ctx.navigate(`/aprovacoes${status === 'pending' ? '' : `?status=${status}`}`, { replace: true });
      } catch (error) {
        feedback.innerHTML = alertBox(errorMessage(error));
        card.querySelectorAll('button').forEach((button) => { button.disabled = false; });
      }
    };
    const note = () => card.querySelector('[name="note"]')?.value.trim() || null;
    card.querySelector('[data-approve]')?.addEventListener('click', () => run(() => changeRequestsRepository.review(id, true, note()), 'Solicitação aprovada e aplicada.'));
    card.querySelector('[data-reject]')?.addEventListener('click', () => run(() => changeRequestsRepository.review(id, false, note()), 'Solicitação rejeitada.'));
    card.querySelector('[data-cancel]')?.addEventListener('click', () => run(() => changeRequestsRepository.cancel(id), 'Solicitação cancelada.'));
  });
}
