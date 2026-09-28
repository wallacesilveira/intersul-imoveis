/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Leads: lista com filtros, atendimento (responsável, situação, anotações, histórico) e cadastro manual. */
import {
  LEAD_KIND_LABELS, LEAD_STATUS_LABELS, alertBox, bindConfirmButton, displayPhone, emptyState, errorMessage, esc,
  formatDateTime, memberName, routeQuery, whatsappLink,
} from '../lib/ui.js';
import { contactsRepository } from '../repositories/contacts.js';
import { leadsRepository } from '../repositories/leads.js';
import { propertiesRepository } from '../repositories/properties.js';

const STATUS_BADGES = { new: 'badge-gold', in_progress: '', won: 'badge-green', lost: '' };
const ORIGIN_LABELS = { site: 'Site', manual: 'Cadastro manual', whatsapp: 'WhatsApp', import: 'Importação' };
const DETAIL_LABELS = { purpose: 'Objetivo', property_type: 'Tipo do imóvel', city: 'Cidade', address: 'Endereço', address_number: 'Número', address_complement: 'Complemento', property_code: 'Código informado' };

const statusBadge = (status) => `<span class="badge ${STATUS_BADGES[status]}">${LEAD_STATUS_LABELS[status]}</span>`;
const options = (entries, selected) => entries.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export async function leadsListPage(view, ctx) {
  const query = routeQuery();
  const filters = { status: query.get('situacao') ?? 'abertos', kind: query.get('tipo') || '', assigned: query.get('responsavel') || '', text: query.get('q') || '' };
  const statusFilter = filters.status === 'abertos' ? '' : filters.status;
  let leads = await leadsRepository.list(ctx.agency.id, { ...filters, status: statusFilter });
  if (filters.status === 'abertos') leads = leads.filter((lead) => lead.status === 'new' || lead.status === 'in_progress');

  const rows = leads.map((lead) => `<tr data-href="#/leads/${lead.id}" class="${lead.status === 'new' ? 'row-new' : ''}"><td><a href="#/leads/${lead.id}">${esc(lead.contacts?.name || '—')}</a><div class="cell-sub">${esc(displayPhone(lead.contacts?.phone))}</div></td><td>${LEAD_KIND_LABELS[lead.kind]}${lead.properties ? `<div class="cell-sub">${esc(lead.properties.code)} · ${esc(lead.properties.title)}</div>` : ''}</td><td>${statusBadge(lead.status)}</td><td>${lead.assigned_to ? esc(memberName(ctx.team, lead.assigned_to)) : '<span class="muted">Sem responsável</span>'}</td><td>${formatDateTime(lead.created_at)}<div class="cell-sub">${ORIGIN_LABELS[lead.origin]}</div></td></tr>`).join('');

  view.innerHTML = `<header class="page-header"><div><h1>Leads</h1><p class="muted">${ctx.isAdmin ? 'Contatos interessados vindos do site e cadastrados pela equipe. Atribua cada lead a um corretor.' : 'Leads atribuídos a você.'}</p></div><a class="btn btn-primary" href="#/leads/novo">Novo lead</a></header>
    ${ctx.takeFlash()}
    <form class="toolbar" data-filters>
      <input type="search" name="q" value="${esc(filters.text)}" placeholder="Nome, telefone ou e-mail" aria-label="Buscar leads">
      <select name="situacao" aria-label="Situação">${options([['abertos', 'Em aberto'], ['', 'Todas as situações'], ...Object.entries(LEAD_STATUS_LABELS)], filters.status)}</select>
      <select name="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>${options(Object.entries(LEAD_KIND_LABELS), filters.kind)}</select>
      ${ctx.isAdmin ? `<select name="responsavel" aria-label="Responsável"><option value="">Todos os responsáveis</option>${options([['none', 'Sem responsável'], ...ctx.team.map((member) => [member.user_id, member.full_name])], filters.assigned)}</select>` : ''}
      <button class="btn btn-secondary" type="submit">Filtrar</button>
    </form>
    ${leads.length ? `<div class="card table-card"><table class="data-table"><thead><tr><th>Contato</th><th>Interesse</th><th>Situação</th><th>Responsável</th><th>Recebido</th></tr></thead><tbody>${rows}</tbody></table></div><p class="table-count">${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}</p>` : emptyState(filters.status === 'abertos' ? 'Nenhum lead em aberto.' : 'Nenhum lead encontrado.')}`;

  const form = view.querySelector('[data-filters]');
  const apply = (event) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (value || key === 'situacao') params.set(key, value);
    if (params.get('situacao') === 'abertos') params.delete('situacao');
    ctx.navigate(`/leads${params.size ? `?${params}` : ''}`);
  };
  form.addEventListener('submit', apply);
  form.querySelectorAll('select').forEach((select) => select.addEventListener('change', apply));
}

// ---------------------------------------------------------------------------
// Detalhe / atendimento
// ---------------------------------------------------------------------------

function describeActivity(activity, ctx) {
  const who = activity.user_id ? memberName(ctx.team, activity.user_id) : 'Sistema';
  const name = (userId) => (userId ? memberName(ctx.team, userId) : 'ninguém');
  switch (activity.type) {
    case 'created': return [`Lead recebido (${ORIGIN_LABELS[activity.data.origin] || activity.data.origin})`, activity.user_id ? who : ''];
    case 'status_change': return [`Situação: ${LEAD_STATUS_LABELS[activity.data.from]} → ${LEAD_STATUS_LABELS[activity.data.to]}`, who];
    case 'assignment': return [`Responsável: ${name(activity.data.from)} → ${name(activity.data.to)}`, who];
    default: return [activity.body, who];
  }
}

export async function leadDetailPage(view, ctx, id) {
  const lead = await leadsRepository.get(id);
  if (!lead) { view.innerHTML = emptyState('Lead não encontrado ou não atribuído a você.'); return; }
  const contact = lead.contacts;
  const firstName = contact.name.split(' ')[0];
  const whatsapp = contact.whatsapp || contact.phone;
  const greeting = `Olá, ${firstName}! Aqui é ${ctx.member.full_name.split(' ')[0]}, da Intersul Imóveis.${lead.properties ? ` Recebemos seu interesse no imóvel ${lead.properties.code} (${lead.properties.title}).` : ''}`;
  const details = Object.entries(lead.details || {}).filter(([, value]) => value).map(([key, value]) => `<div><dt>${esc(DETAIL_LABELS[key] || key)}</dt><dd>${esc(value)}</dd></div>`).join('');
  const activities = [...(lead.lead_activities || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((activity) => {
    const [text, who] = describeActivity(activity, ctx);
    return `<li class="timeline-item timeline-${activity.type}"><p class="${activity.type === 'note' ? 'pre-line' : ''}">${esc(text)}</p><span class="muted">${formatDateTime(activity.created_at)}${who ? ` · ${esc(who)}` : ''}</span></li>`;
  }).join('');
  const assignField = ctx.isAdmin
    ? `<select id="l-assigned" name="assigned_to"><option value="">Sem responsável</option>${options(ctx.team.filter((member) => member.active || member.user_id === lead.assigned_to).map((member) => [member.user_id, member.full_name]), lead.assigned_to || '')}</select>`
    : `<input id="l-assigned" value="${esc(memberName(ctx.team, lead.assigned_to))}" disabled>`;

  view.innerHTML = `<header class="page-header"><div><a class="back-link" href="#/leads">← Leads</a><h1>${esc(contact.name)}</h1><p class="muted">${LEAD_KIND_LABELS[lead.kind]} · ${ORIGIN_LABELS[lead.origin]} · ${formatDateTime(lead.created_at)} ${statusBadge(lead.status)}</p></div><div class="header-actions">${whatsapp ? `<a class="btn btn-whatsapp" href="${esc(whatsappLink(whatsapp))}?text=${encodeURIComponent(greeting)}" target="_blank" rel="noreferrer">Chamar no WhatsApp</a>` : ''}<a class="btn btn-secondary" href="#/contatos/${contact.id}">Ver contato</a>${ctx.isAdmin ? '<button class="btn btn-danger" type="button" data-delete>Excluir</button>' : ''}</div></header>
    ${ctx.takeFlash()}<div data-feedback></div>
    <div class="detail-columns">
      <section class="card"><h2>Solicitação</h2><dl class="info-list">
        <div><dt>Telefone</dt><dd>${esc(displayPhone(contact.phone) || '—')}</dd></div>
        <div><dt>E-mail</dt><dd>${contact.email ? `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : '—'}</dd></div>
        <div><dt>Imóvel</dt><dd>${lead.properties ? `<a href="#/imoveis/${lead.properties.id}">${esc(lead.properties.code)} · ${esc(lead.properties.title)}</a>` : '—'}</dd></div>
        ${lead.consent_at ? `<div><dt>Autorização</dt><dd>Contato autorizado em ${formatDateTime(lead.consent_at)}</dd></div>` : ''}
      </dl>
      ${lead.message ? `<h3>Mensagem</h3><p class="pre-line message-box">${esc(lead.message)}</p>` : ''}
      ${details ? `<h3>Imóvel oferecido pelo proprietário</h3><dl class="info-list">${details}</dl><p class="muted form-note">Para registrar a pessoa como proprietária, use "Ver contato".</p>` : ''}
      </section>
      <form class="card stack" data-lead-form><h2>Atendimento</h2>
        <div class="field"><label for="l-assigned">Corretor responsável</label>${assignField}</div>
        <div class="field"><label for="l-status">Situação</label><select id="l-status" name="status">${options(Object.entries(LEAD_STATUS_LABELS), lead.status)}</select></div>
        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
    </div>
    <section class="card"><h2>Histórico</h2>
      <form class="note-form" data-note-form><div class="field"><label for="l-note">Nova anotação</label><textarea id="l-note" name="note" rows="3" maxlength="5000" placeholder="Ex.: Liguei, pediu visita no sábado às 10h." required></textarea></div><button class="btn btn-secondary" type="submit">Adicionar anotação</button></form>
      <ol class="timeline">${activities}</ol>
    </section>`;

  const feedback = view.querySelector('[data-feedback]');
  const reload = (message) => { ctx.flash(message); ctx.refreshBadges(); ctx.navigate(`/leads/${id}`, { replace: true }); };

  const form = view.querySelector('[data-lead-form]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const patch = { status: form.status.value };
    if (ctx.isAdmin) patch.assigned_to = form.assigned_to.value || null;
    const changed = Object.keys(patch).filter((key) => (patch[key] ?? null) !== (lead[key] ?? null));
    if (!changed.length) { feedback.innerHTML = alertBox('Nenhuma alteração para salvar.', 'info'); return; }
    try {
      await leadsRepository.update(id, Object.fromEntries(changed.map((key) => [key, patch[key]])));
      reload('Atendimento atualizado.');
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  });

  const noteForm = view.querySelector('[data-note-form]');
  noteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = noteForm.note.value.trim();
    if (!text) return;
    try {
      await leadsRepository.addNote(ctx.agency.id, id, text);
      // primeira anotação num lead novo: passa para "em atendimento"
      if (lead.status === 'new') await leadsRepository.update(id, { status: 'in_progress' });
      reload(lead.status === 'new' ? 'Anotação adicionada. O lead passou para "Em atendimento".' : 'Anotação adicionada.');
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  });

  const deleteButton = view.querySelector('[data-delete]');
  if (deleteButton) bindConfirmButton(deleteButton, async () => {
    try {
      await leadsRepository.remove(id);
      ctx.flash('Lead excluído.');
      ctx.refreshBadges();
      ctx.navigate('/leads');
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  });
}

// ---------------------------------------------------------------------------
// Cadastro manual (ligação, visita à loja, indicação...)
// ---------------------------------------------------------------------------

export async function leadFormPage(view, ctx) {
  const presetContact = routeQuery().get('contato') || '';
  const [contacts, properties] = await Promise.all([
    contactsRepository.list(ctx.agency.id),
    propertiesRepository.list(ctx.agency.id),
  ]);
  const assignField = ctx.isAdmin
    ? `<div class="field"><label for="n-assigned">Corretor responsável</label><select id="n-assigned" name="assigned_to"><option value="">Sem responsável</option>${options(ctx.team.filter((member) => member.active).map((member) => [member.user_id, member.full_name]), ctx.user.id)}</select></div>`
    : '';
  view.innerHTML = `<header class="page-header"><div><a class="back-link" href="#/leads">← Leads</a><h1>Novo lead</h1><p class="muted">Registre um interesse recebido por telefone, na loja ou por indicação.${ctx.isAdmin ? '' : ' O lead fica sob sua responsabilidade.'}</p></div></header>
    <form class="card form-card" data-new-lead novalidate><div class="form-grid">
      <div class="field field-full"><label for="n-contact">Contato *</label><select id="n-contact" name="contact_id" required><option value="">Selecione</option>${options(contacts.map((contact) => [contact.id, `${contact.name}${contact.phone ? ` · ${displayPhone(contact.phone)}` : ''}`]), presetContact)}</select><small class="muted">Não encontrou? <a href="#/contatos/novo">Cadastre o contato</a> e volte aqui.</small></div>
      <div class="field"><label for="n-kind">Tipo</label><select id="n-kind" name="kind">${options(Object.entries(LEAD_KIND_LABELS), 'property_interest')}</select></div>
      <div class="field"><label for="n-property">Imóvel de interesse</label><select id="n-property" name="property_id"><option value="">Nenhum</option>${options(properties.map((property) => [property.id, `${property.code} · ${property.title}`]), '')}</select></div>
      ${assignField}
      <div class="field field-full"><label for="n-message">Mensagem / observação</label><textarea id="n-message" name="message" maxlength="2000"></textarea></div>
    </div><div data-feedback></div><div class="form-actions"><button class="btn btn-primary" type="submit">Registrar lead</button><a class="btn btn-secondary" href="#/leads">Cancelar</a></div></form>`;

  const form = view.querySelector('[data-new-lead]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = form.querySelector('[data-feedback]');
    if (!form.contact_id.value) { feedback.innerHTML = alertBox('Selecione o contato.'); return; }
    const row = {
      contact_id: form.contact_id.value,
      kind: form.kind.value,
      property_id: form.property_id.value || null,
      message: form.message.value.trim() || null,
      assigned_to: ctx.isAdmin ? form.assigned_to.value || null : ctx.user.id,
    };
    try {
      const created = await leadsRepository.create(ctx.agency.id, row);
      ctx.flash('Lead registrado.');
      ctx.refreshBadges();
      ctx.navigate(`/leads/${created.id}`);
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  });
}
