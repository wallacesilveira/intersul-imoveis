/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Contatos: lista, cadastro/edição e detalhe (com papel de proprietário e interesses). */
import { formatDocument, formatPhone, isValidDocument, onlyDigits } from '../../shared/format.js';
import {
  LEAD_KIND_LABELS, LEAD_STATUS_LABELS, OWNER_STATUS_LABELS, alertBox, bindConfirmButton, displayPhone, emptyState,
  errorMessage, esc, formatDate, memberName, routeQuery, whatsappLink,
} from '../lib/ui.js';
import { contactsRepository } from '../repositories/contacts.js';
import { ownersRepository } from '../repositories/owners.js';

export async function contactsListPage(view, ctx) {
  const search = routeQuery().get('q') || '';
  const contacts = await contactsRepository.list(ctx.agency.id, search);
  const rows = contacts.map((contact) => {
    // owners vem como objeto único (um contato tem no máximo um registro de proprietário) ou null; leads vem como lista
    const roles = [contact.owners && '<span class="badge badge-gold">Proprietário</span>', contact.leads?.length && '<span class="badge">Interessado</span>'].filter(Boolean).join(' ');
    return `<tr data-href="#/contatos/${contact.id}"><td><a href="#/contatos/${contact.id}">${esc(contact.name)}</a></td><td>${esc(displayPhone(contact.phone))}</td><td>${esc(contact.email || '')}</td><td>${roles}</td><td>${formatDate(contact.created_at)}</td></tr>`;
  }).join('');
  view.innerHTML = `<header class="page-header"><div><h1>Contatos</h1><p class="muted">Pessoas cadastradas: proprietários, interessados e outros contatos.</p></div><a class="btn btn-primary" href="#/contatos/novo">Novo contato</a></header>
    ${ctx.takeFlash()}<form class="toolbar" data-search><input type="search" name="q" value="${esc(search)}" placeholder="Buscar por nome, telefone ou e-mail" aria-label="Buscar contatos"><button class="btn btn-secondary" type="submit">Buscar</button>${search ? '<a class="link-button" href="#/contatos">Limpar</a>' : ''}</form>
    ${contacts.length ? `<div class="card table-card"><table class="data-table"><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Papéis</th><th>Cadastro</th></tr></thead><tbody>${rows}</tbody></table></div><p class="table-count">${contacts.length} ${contacts.length === 1 ? 'contato' : 'contatos'}</p>` : emptyState(search ? 'Nenhum contato encontrado com essa busca.' : 'Nenhum contato cadastrado ainda.')}`;
  view.querySelector('[data-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    const q = event.currentTarget.q.value.trim();
    ctx.navigate(q ? `/contatos?q=${encodeURIComponent(q)}` : '/contatos');
  });
}

export async function contactFormPage(view, ctx, id) {
  const contact = id ? await contactsRepository.get(id) : {};
  if (id && !contact) { view.innerHTML = emptyState('Contato não encontrado ou sem permissão de acesso.'); return; }
  const asOwner = !id && routeQuery().get('proprietario') === '1';
  const title = id ? 'Editar contato' : asOwner ? 'Novo proprietário' : 'Novo contato';
  const value = (field) => esc(contact[field] || '');
  view.innerHTML = `<header class="page-header"><div><a class="back-link" href="${id ? `#/contatos/${id}` : asOwner ? '#/proprietarios' : '#/contatos'}">← Voltar</a><h1>${title}</h1>${asOwner ? '<p class="muted">Cadastre a pessoa; ela será registrada como proprietária sob sua responsabilidade.</p>' : ''}</div></header>
    <form class="card form-card" data-contact-form novalidate><div class="form-grid">
      <div class="field field-full"><label for="c-name">Nome *</label><input id="c-name" name="name" value="${value('name')}" required minlength="2" maxlength="200"></div>
      <div class="field"><label for="c-phone">Telefone</label><input id="c-phone" name="phone" type="tel" inputmode="tel" maxlength="15" placeholder="(11) 99999-9999" value="${esc(displayPhone(contact.phone))}"></div>
      <div class="field"><label for="c-whatsapp">WhatsApp (se for outro número)</label><input id="c-whatsapp" name="whatsapp" type="tel" inputmode="tel" maxlength="15" placeholder="(11) 99999-9999" value="${esc(displayPhone(contact.whatsapp))}"></div>
      <div class="field"><label for="c-email">E-mail</label><input id="c-email" name="email" type="email" value="${value('email')}"></div>
      <div class="field"><label for="c-document">CPF / CNPJ</label><input id="c-document" name="document" inputmode="numeric" placeholder="000.000.000-00" value="${esc(formatDocument(contact.document))}"></div>
      <div class="field field-full"><label for="c-notes">Observações</label><textarea id="c-notes" name="notes">${value('notes')}</textarea></div>
    </div><div data-feedback></div><div class="form-actions"><button class="btn btn-primary" type="submit">Salvar</button><a class="btn btn-secondary" href="${id ? `#/contatos/${id}` : '#/contatos'}">Cancelar</a></div></form>`;

  const form = view.querySelector('[data-contact-form]');
  form.document.addEventListener('input', () => { form.document.value = formatDocument(form.document.value); });
  form.querySelectorAll('input[type="tel"]').forEach((input) => input.addEventListener('input', () => { input.value = formatPhone(input.value); }));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const feedback = form.querySelector('[data-feedback]');
    const data = Object.fromEntries(new FormData(form));
    const problem = validateContact(data);
    if (problem) { feedback.innerHTML = alertBox(problem); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      data.phone = onlyDigits(data.phone);
      data.whatsapp = onlyDigits(data.whatsapp);
      data.document = onlyDigits(data.document);
      if (id) {
        await contactsRepository.update(id, data);
        ctx.flash('Contato atualizado.');
        ctx.navigate(`/contatos/${id}`);
        return;
      }
      const created = await contactsRepository.create(ctx.agency.id, data);
      if (asOwner) {
        const owner = await ownersRepository.create(ctx.agency.id, created.id, ctx.user.id);
        ctx.flash('Proprietário cadastrado.');
        ctx.navigate(`/proprietarios/${owner.id}`);
        return;
      }
      ctx.flash('Contato cadastrado.');
      ctx.navigate(`/contatos/${created.id}`);
    } catch (error) {
      feedback.innerHTML = alertBox(error?.code === '23505' ? 'Já existe um contato com este telefone. Busque por ele na lista de contatos; se não aparecer para você, fale com o administrador.' : errorMessage(error));
    } finally {
      button.disabled = false;
    }
  });
}

function validateContact(data) {
  if (data.name.trim().length < 2) return 'Informe o nome.';
  for (const [field, label] of [['phone', 'telefone'], ['whatsapp', 'WhatsApp']]) {
    const digits = onlyDigits(data[field]);
    if (digits && (digits.length < 10 || digits.length > 11)) return `Informe o ${label} com DDD (10 ou 11 dígitos).`;
  }
  if (onlyDigits(data.document) && !isValidDocument(data.document)) return 'Confira o CPF ou CNPJ: os dígitos não conferem.';
  if (data.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim())) return 'Confira o e-mail informado.';
  return '';
}

export async function contactDetailPage(view, ctx, id) {
  const [contact, owner, leads] = await Promise.all([contactsRepository.get(id), ownersRepository.findByContact(id), contactsRepository.leads(id)]);
  if (!contact) { view.innerHTML = emptyState('Contato não encontrado ou sem permissão de acesso.'); return; }
  const whatsapp = contact.whatsapp || contact.phone;
  const info = [
    ['Nome', esc(contact.name)],
    ['Telefone', contact.phone ? esc(displayPhone(contact.phone)) : '—'],
    ['WhatsApp', whatsapp ? `<a href="${esc(whatsappLink(whatsapp))}" target="_blank" rel="noreferrer">${esc(displayPhone(whatsapp))}</a>` : '—'],
    ['E-mail', contact.email ? `<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>` : '—'],
    ['CPF / CNPJ', esc(contact.document ? formatDocument(contact.document) : '—')],
    ['Cadastrado em', formatDate(contact.created_at)],
  ].map(([label, content]) => `<div><dt>${label}</dt><dd>${content}</dd></div>`).join('');

  const ownerCard = owner
    ? `<p><span class="badge badge-gold">Proprietário</span> <span class="badge">${OWNER_STATUS_LABELS[owner.status]}</span></p><p class="muted">Responsável: ${esc(memberName(ctx.team, owner.responsible_user_id))}</p><a class="btn btn-secondary" href="#/proprietarios/${owner.id}">Ver proprietário</a>`
    : `<p class="muted">Este contato não está registrado como proprietário${ctx.isAdmin ? '' : ' na sua carteira'}.</p>${ownerForm(ctx)}`;

  const leadRows = leads.map((lead) => `<tr><td>${formatDate(lead.created_at)}</td><td>${LEAD_KIND_LABELS[lead.kind]}</td><td>${lead.properties ? `${esc(lead.properties.code)} · ${esc(lead.properties.title)}` : '—'}</td><td><span class="badge">${LEAD_STATUS_LABELS[lead.status]}</span></td><td>${esc(memberName(ctx.team, lead.assigned_to))}</td></tr>`).join('');

  view.innerHTML = `<header class="page-header"><div><a class="back-link" href="#/contatos">← Contatos</a><h1>${esc(contact.name)}</h1></div><div class="header-actions"><a class="btn btn-secondary" href="#/contatos/${id}/editar">Editar</a>${ctx.isAdmin ? '<button class="btn btn-danger" type="button" data-delete>Excluir</button>' : ''}</div></header>
    ${ctx.takeFlash()}<div data-feedback></div>
    <div class="detail-columns">
      <section class="card"><h2>Dados</h2><dl class="info-list">${info}</dl>${contact.notes ? `<h3>Observações</h3><p class="pre-line">${esc(contact.notes)}</p>` : ''}</section>
      <section class="card"><h2>Proprietário</h2><div class="stack">${ownerCard}</div></section>
    </div>
    <section class="card"><h2>Interesses</h2>${leads.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Imóvel</th><th>Situação</th><th>Responsável</th></tr></thead><tbody>${leadRows}</tbody></table></div>` : '<p class="muted">Nenhum interesse registrado.</p>'}</section>`;

  const feedback = view.querySelector('[data-feedback]');
  const deleteButton = view.querySelector('[data-delete]');
  if (deleteButton) bindConfirmButton(deleteButton, async () => {
    try {
      await contactsRepository.remove(id);
      ctx.flash('Contato excluído.');
      ctx.navigate('/contatos');
    } catch (error) {
      feedback.innerHTML = alertBox(error?.code === '23503' ? 'Este contato tem interesses registrados ou é proprietário, por isso não pode ser excluído.' : errorMessage(error));
    }
  });

  const form = view.querySelector('[data-owner-form]');
  if (form) form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const created = await ownersRepository.create(ctx.agency.id, id, form.responsible?.value || ctx.user.id);
      ctx.flash('Contato registrado como proprietário.');
      ctx.navigate(`/proprietarios/${created.id}`);
    } catch (error) {
      feedback.innerHTML = alertBox(error?.code === '23505' ? 'Este contato já é proprietário na carteira de outro corretor. Fale com o administrador.' : errorMessage(error));
    }
  });
}

function ownerForm(ctx) {
  const responsible = ctx.isAdmin
    ? `<div class="field"><label for="owner-responsible">Corretor responsável</label><select id="owner-responsible" name="responsible">${ctx.team.filter((member) => member.active).map((member) => `<option value="${member.user_id}"${member.user_id === ctx.user.id ? ' selected' : ''}>${esc(member.full_name)}</option>`).join('')}</select></div>`
    : '';
  return `<form class="stack" data-owner-form>${responsible}<button class="btn btn-primary" type="submit">Registrar como proprietário</button></form>`;
}
