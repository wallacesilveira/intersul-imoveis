/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Proprietários: carteira por corretor, responsável, situação e imóveis vinculados. */
import { formatDocument } from '../../shared/format.js';
import { PROPERTY_STATUS } from '../../shared/property-model.js';
import {
  OWNER_STATUS_LABELS, alertBox, bindConfirmButton, displayPhone, emptyState, errorMessage, esc, formatDate,
  memberName, routeQuery, whatsappLink,
} from '../lib/ui.js';
import { ownersRepository } from '../repositories/owners.js';

export async function ownersListPage(view, ctx) {
  const responsible = ctx.isAdmin ? routeQuery().get('responsavel') || '' : '';
  const owners = await ownersRepository.list(ctx.agency.id, responsible);
  const filter = ctx.isAdmin
    ? `<form class="toolbar" data-filter><label class="inline-label" for="owner-filter">Responsável</label><select id="owner-filter" name="responsavel"><option value="">Todos</option>${ctx.team.map((member) => `<option value="${member.user_id}"${member.user_id === responsible ? ' selected' : ''}>${esc(member.full_name)}</option>`).join('')}</select></form>`
    : '<p class="muted">Proprietários sob sua responsabilidade.</p>';
  const rows = owners.map((owner) => `<tr data-href="#/proprietarios/${owner.id}"><td><a href="#/proprietarios/${owner.id}">${esc(owner.contacts.name)}</a></td><td>${esc(displayPhone(owner.contacts.phone))}</td><td>${esc(memberName(ctx.team, owner.responsible_user_id))}</td><td>${owner.property_owners.length}</td><td><span class="badge${owner.status === 'active' ? ' badge-green' : ''}">${OWNER_STATUS_LABELS[owner.status]}</span></td></tr>`).join('');
  view.innerHTML = `<header class="page-header"><div><h1>Proprietários</h1></div><a class="btn btn-primary" href="#/contatos/novo?proprietario=1">Novo proprietário</a></header>
    ${ctx.takeFlash()}${filter}
    ${owners.length ? `<div class="card table-card"><table class="data-table"><thead><tr><th>Nome</th><th>Telefone</th><th>Responsável</th><th>Imóveis</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table></div><p class="table-count">${owners.length} ${owners.length === 1 ? 'proprietário' : 'proprietários'}</p>` : emptyState('Nenhum proprietário cadastrado ainda.')}`;
  view.querySelector('[data-filter]')?.addEventListener('change', (event) => {
    const value = event.target.value;
    ctx.navigate(value ? `/proprietarios?responsavel=${value}` : '/proprietarios');
  });
}

export async function ownerDetailPage(view, ctx, id) {
  const owner = await ownersRepository.get(id);
  if (!owner) { view.innerHTML = emptyState('Proprietário não encontrado ou sem permissão de acesso.'); return; }
  const contact = owner.contacts;
  const whatsapp = contact.whatsapp || contact.phone;
  const responsibleField = ctx.isAdmin
    ? `<select id="o-responsible" name="responsible_user_id">${ctx.team.map((member) => `<option value="${member.user_id}"${member.user_id === owner.responsible_user_id ? ' selected' : ''}${!member.active && member.user_id !== owner.responsible_user_id ? ' disabled' : ''}>${esc(member.full_name)}</option>`).join('')}</select>`
    : `<input id="o-responsible" value="${esc(memberName(ctx.team, owner.responsible_user_id))}" disabled><small class="muted">Transferências são feitas pelo administrador.</small>`;
  const properties = owner.property_owners.map(({ properties: property, share_percent: share }) => `<tr><td>${esc(property.code)}</td><td>${esc(property.title)}</td><td>${PROPERTY_STATUS[property.status]}</td><td>${property.published ? '<span class="badge badge-green">Publicado</span>' : '<span class="badge">Não publicado</span>'}</td><td>${share ? `${share}%` : '—'}</td></tr>`).join('');

  view.innerHTML = `<header class="page-header"><div><a class="back-link" href="#/proprietarios">← Proprietários</a><h1>${esc(contact.name)}</h1><p class="muted">Proprietário desde ${formatDate(owner.created_at)}</p></div><div class="header-actions"><a class="btn btn-secondary" href="#/contatos/${contact.id}">Ver contato</a>${ctx.isAdmin ? '<button class="btn btn-danger" type="button" data-delete>Remover papel de proprietário</button>' : ''}</div></header>
    ${ctx.takeFlash()}<div data-feedback></div>
    <div class="detail-columns">
      <form class="card stack" data-owner-form><h2>Relacionamento</h2>
        <div class="field"><label for="o-responsible">Corretor responsável</label>${responsibleField}</div>
        <div class="field"><label for="o-status">Situação</label><select id="o-status" name="status">${Object.entries(OWNER_STATUS_LABELS).map(([value, label]) => `<option value="${value}"${value === owner.status ? ' selected' : ''}>${label}</option>`).join('')}</select></div>
        <div class="field"><label for="o-notes">Observações sobre o proprietário</label><textarea id="o-notes" name="notes" placeholder="Preferências, melhor horário de contato, combinados...">${esc(owner.notes || '')}</textarea></div>
        <div><button class="btn btn-primary" type="submit">Salvar</button></div>
      </form>
      <section class="card"><h2>Contato</h2><dl class="info-list">
        <div><dt>Nome</dt><dd>${esc(contact.name)}</dd></div>
        <div><dt>Telefone</dt><dd>${contact.phone ? esc(displayPhone(contact.phone)) : '—'}</dd></div>
        <div><dt>WhatsApp</dt><dd>${whatsapp ? `<a href="${esc(whatsappLink(whatsapp))}" target="_blank" rel="noreferrer">${esc(displayPhone(whatsapp))}</a>` : '—'}</dd></div>
        <div><dt>E-mail</dt><dd>${contact.email ? `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : '—'}</dd></div>
        <div><dt>CPF / CNPJ</dt><dd>${esc(contact.document ? formatDocument(contact.document) : '—')}</dd></div>
      </dl></section>
    </div>
    <section class="card"><h2>Imóveis</h2>${properties ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Código</th><th>Título</th><th>Situação</th><th>Site</th><th>Participação</th></tr></thead><tbody>${properties}</tbody></table></div>` : '<p class="muted">Nenhum imóvel vinculado. O vínculo é feito no cadastro do imóvel.</p>'}</section>`;

  const feedback = view.querySelector('[data-feedback]');
  const form = view.querySelector('[data-owner-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const patch = { status: form.status.value, notes: form.notes.value.trim() || null };
    if (ctx.isAdmin) patch.responsible_user_id = form.responsible_user_id.value;
    try {
      await ownersRepository.update(id, patch);
      ctx.flash('Proprietário atualizado.');
      ctx.navigate(`/proprietarios/${id}`, { replace: true });
    } catch (error) {
      feedback.innerHTML = alertBox(errorMessage(error));
    }
  });

  const deleteButton = view.querySelector('[data-delete]');
  if (deleteButton) bindConfirmButton(deleteButton, async () => {
    try {
      await ownersRepository.remove(id);
      ctx.flash('O contato deixou de ser proprietário. Os dados da pessoa continuam em Contatos.');
      ctx.navigate('/proprietarios');
    } catch (error) {
      feedback.innerHTML = alertBox(errorMessage(error));
    }
  });
}
