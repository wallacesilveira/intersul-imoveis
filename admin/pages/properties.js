/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Imóveis: lista com filtros, cadastro/edição, vínculo com proprietários e alterações sujeitas a aprovação. */
import { formatCep, formatCurrency, formatMoneyInput, onlyDigits, parseMoney } from '../../shared/format.js';
import { DEFAULT_PROTECTED_PROPERTY_FIELDS, PROPERTY_STATUS, PROPERTY_TYPES, SERVICE_AREAS } from '../../shared/property-model.js';
import { mountPhotoManager } from '../components/photo-manager.js';
import { alertBox, bindConfirmButton, displayPhone, emptyState, errorMessage, esc, formatDateTime, memberName, routeQuery } from '../lib/ui.js';
import { changeRequestsRepository } from '../repositories/change-requests.js';
import { ownersRepository } from '../repositories/owners.js';
import { PROPERTY_FIELDS, propertiesRepository } from '../repositories/properties.js';

const MONEY_FIELDS = ['sale_price', 'rent_price', 'condo_fee', 'iptu_monthly'];
const NUMBER_FIELDS = ['bedrooms', 'suites', 'bathrooms', 'parking', 'area_m2', 'land_area_m2'];
const BOOLEAN_FIELDS = ['for_sale', 'for_rent', 'published', 'featured'];

export const FIELD_LABELS = {
  code: 'Código', title: 'Título', description: 'Descrição', type: 'Tipo', for_sale: 'À venda', sale_price: 'Preço de venda',
  for_rent: 'Para locação', rent_price: 'Aluguel mensal', condo_fee: 'Condomínio', iptu_monthly: 'IPTU mensal',
  neighborhood: 'Bairro', city: 'Cidade', state: 'UF', condominium: 'Condomínio / edifício', zip_code: 'CEP', address: 'Endereço',
  address_number: 'Número', address_complement: 'Complemento', bedrooms: 'Dormitórios', suites: 'Suítes', bathrooms: 'Banheiros',
  parking: 'Vagas', area_m2: 'Área útil (m²)', land_area_m2: 'Área do terreno (m²)', status: 'Situação', published: 'Publicado no site',
  featured: 'Destaque na home', responsible_user_id: 'Corretor responsável', archived_at: 'Arquivado',
};

/** Valor de um campo em texto legível (usado nas solicitações de aprovação). */
export function describeValue(field, value, team) {
  if (value === null || value === undefined || value === '') return MONEY_FIELDS.includes(field) ? 'sob consulta' : '—';
  if (MONEY_FIELDS.includes(field)) return formatCurrency(value);
  if (BOOLEAN_FIELDS.includes(field)) return value ? 'Sim' : 'Não';
  if (field === 'status') return PROPERTY_STATUS[value] || value;
  if (field === 'type') return PROPERTY_TYPES[value] || value;
  if (field === 'responsible_user_id') return memberName(team, value);
  return String(value);
}

export function protectedFields(ctx) {
  const custom = ctx.agency.settings?.approval_rules?.property_fields;
  return Array.isArray(custom) ? custom : DEFAULT_PROTECTED_PROPERTY_FIELDS;
}

function priceSummary(property) {
  const parts = [];
  if (property.for_sale) parts.push(property.sale_price === null ? 'Venda sob consulta' : formatCurrency(property.sale_price));
  if (property.for_rent) parts.push(property.rent_price === null ? 'Locação sob consulta' : `${formatCurrency(property.rent_price)}/mês`);
  return parts.join(' · ');
}

function statusBadges(property) {
  return `<span class="badge${property.status === 'available' ? ' badge-green' : ''}">${PROPERTY_STATUS[property.status]}</span> ${property.published ? '<span class="badge badge-green">No site</span>' : '<span class="badge">Fora do site</span>'}${property.featured ? ' <span class="badge badge-gold">Destaque</span>' : ''}`;
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export async function propertiesListPage(view, ctx) {
  const query = routeQuery();
  const filters = { text: query.get('q') || '', status: query.get('situacao') || '', published: query.get('site') || '', responsible: query.get('responsavel') || '', archived: query.get('arquivados') === '1' };
  const properties = await propertiesRepository.list(ctx.agency.id, filters);
  const options = (entries, selected) => entries.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
  const rows = properties.map((property) => `<tr data-href="#/imoveis/${property.id}"><td><a href="#/imoveis/${property.id}">${esc(property.code)}</a>${property.source === 'demo' ? ' <span class="badge">demo</span>' : ''}</td><td>${esc(property.title)}<div class="cell-sub">${esc(PROPERTY_TYPES[property.type] || property.type)} · ${esc(property.neighborhood)}</div></td><td>${esc(priceSummary(property))}</td><td>${statusBadges(property)}</td><td>${esc(memberName(ctx.team, property.responsible_user_id))}</td><td>${property.property_photos.length}</td></tr>`).join('');

  view.innerHTML = `<header class="page-header"><div><h1>Imóveis</h1><p class="muted">Estoque da imobiliária. Só aparecem no site os imóveis publicados, disponíveis ou reservados.</p></div><a class="btn btn-primary" href="#/imoveis/novo">Novo imóvel</a></header>
    ${ctx.takeFlash()}
    <form class="toolbar" data-filters>
      <input type="search" name="q" value="${esc(filters.text)}" placeholder="Código, título, bairro ou condomínio" aria-label="Buscar imóveis">
      <select name="situacao" aria-label="Situação"><option value="">Todas as situações</option>${options(Object.entries(PROPERTY_STATUS), filters.status)}</select>
      <select name="site" aria-label="Publicação"><option value="">No site e fora</option>${options([['sim', 'No site'], ['nao', 'Fora do site']], filters.published)}</select>
      ${ctx.isAdmin ? `<select name="responsavel" aria-label="Corretor"><option value="">Todos os corretores</option>${options(ctx.team.map((member) => [member.user_id, member.full_name]), filters.responsible)}</select>` : ''}
      <label class="check-inline"><input type="checkbox" name="arquivados" value="1"${filters.archived ? ' checked' : ''}> Arquivados</label>
      <button class="btn btn-secondary" type="submit">Filtrar</button>
    </form>
    ${properties.length ? `<div class="card table-card"><table class="data-table"><thead><tr><th>Código</th><th>Imóvel</th><th>Valor</th><th>Situação</th><th>Responsável</th><th>Fotos</th></tr></thead><tbody>${rows}</tbody></table></div><p class="table-count">${properties.length} ${properties.length === 1 ? 'imóvel' : 'imóveis'}</p>` : emptyState('Nenhum imóvel encontrado.')}`;

  const form = view.querySelector('[data-filters]');
  const apply = (event) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (value) params.set(key, value);
    ctx.navigate(`/imoveis${params.size ? `?${params}` : ''}`);
  };
  form.addEventListener('submit', apply);
  form.querySelectorAll('select, input[type="checkbox"]').forEach((input) => input.addEventListener('change', apply));
}

// ---------------------------------------------------------------------------
// Cadastro / edição
// ---------------------------------------------------------------------------

export async function propertyFormPage(view, ctx, id) {
  const [property, pending, owners] = await Promise.all([
    id ? propertiesRepository.get(id) : null,
    id ? changeRequestsRepository.forEntity(id) : [],
    id ? ownersRepository.list(ctx.agency.id) : [],
  ]);
  if (id && !property) { view.innerHTML = emptyState('Imóvel não encontrado.'); return; }
  const current = property || { city: 'São Paulo', state: 'SP', status: 'available', for_sale: true, responsible_user_id: ctx.user.id };
  const canEdit = ctx.isAdmin || current.responsible_user_id === ctx.user.id;
  const guarded = new Set(ctx.isAdmin ? [] : protectedFields(ctx));
  const lock = (field) => (id && guarded.has(field) ? ' <span class="approval-tag" title="Alteração enviada para aprovação do administrador">requer aprovação</span>' : '');
  const val = (field) => esc(current[field] ?? '');
  const money = (field) => esc(current[field] === null || current[field] === undefined ? '' : formatMoneyInput(String(Math.round(current[field]))));
  const number = (field) => esc(current[field] ?? '');
  const checked = (field) => (current[field] ? ' checked' : '');
  const typeOptions = Object.entries(PROPERTY_TYPES).map(([value, label]) => `<option value="${value}"${value === current.type ? ' selected' : ''}>${label}</option>`).join('');
  const statusOptions = Object.entries(PROPERTY_STATUS).map(([value, label]) => `<option value="${value}"${value === current.status ? ' selected' : ''}>${label}</option>`).join('');
  const responsibleField = ctx.isAdmin
    ? `<select id="p-responsible" name="responsible_user_id">${ctx.team.map((member) => `<option value="${member.user_id}"${member.user_id === current.responsible_user_id ? ' selected' : ''}>${esc(member.full_name)}</option>`).join('')}</select>`
    : `<input id="p-responsible" value="${esc(memberName(ctx.team, current.responsible_user_id))}" disabled>`;
  const publicLink = property?.published && ['available', 'reserved'].includes(property.status) && !property.archived_at ? `<a class="btn btn-secondary" href="../#/imovel/${encodeURIComponent(property.code)}" target="_blank" rel="noreferrer">Ver no site ↗</a>` : '';
  const title = id ? `${esc(property.code)} · ${esc(property.title)}` : 'Novo imóvel';

  view.innerHTML = `<header class="page-header"><div><a class="back-link" href="#/imoveis">← Imóveis</a><h1>${title}</h1>${id ? `<p class="muted">${statusBadges(property)}${property.archived_at ? ' <span class="badge">Arquivado</span>' : ''}</p>` : ''}</div><div class="header-actions">${publicLink}${id && canEdit ? `<button class="btn btn-danger" type="button" data-archive>${ctx.isAdmin ? 'Arquivar' : 'Solicitar arquivamento'}</button>` : ''}${id && ctx.isAdmin ? '<button class="btn btn-danger" type="button" data-delete>Excluir</button>' : ''}</div></header>
    ${ctx.takeFlash()}<div data-feedback></div>
    ${!canEdit ? alertBox('Você pode consultar este imóvel, mas só o corretor responsável ou o administrador podem alterá-lo.', 'info') : ''}
    ${pendingBlock(pending, current, ctx)}
    ${id ? '<div data-photos></div>' : '<p class="muted form-note">Depois de cadastrar o imóvel, você poderá adicionar as fotos.</p>'}
    <form class="property-form" data-property-form novalidate><fieldset${canEdit ? '' : ' disabled'}>
      <section class="card"><h2>Dados do imóvel</h2><div class="form-grid">
        <div class="field field-full"><label for="p-title">Título *</label><input id="p-title" name="title" value="${val('title')}" maxlength="200" required placeholder="Ex.: Casa com jardim em Interlagos"></div>
        <div class="field"><label for="p-type">Tipo *</label><select id="p-type" name="type" required><option value="">Selecione</option>${typeOptions}</select></div>
        <div class="field"><label for="p-code">Código${lock('code')}</label><input id="p-code" name="code" value="${val('code')}" maxlength="30" placeholder="${id ? '' : 'Gerado automaticamente'}"></div>
        <div class="field field-full"><label for="p-description">Descrição</label><textarea id="p-description" name="description" rows="7" placeholder="Descreva o imóvel como ele deve aparecer no site.">${val('description')}</textarea></div>
      </div></section>

      <section class="card"><h2>Valores</h2><div class="form-grid">
        <div class="field"><label class="check-inline"><input type="checkbox" name="for_sale"${checked('for_sale')}> À venda${lock('for_sale')}</label><input name="sale_price" inputmode="numeric" aria-label="Preço de venda" placeholder="Preço de venda (vazio = sob consulta)" value="${money('sale_price')}" data-money></div>
        <div class="field"><label class="check-inline"><input type="checkbox" name="for_rent"${checked('for_rent')}> Para locação${lock('for_rent')}</label><input name="rent_price" inputmode="numeric" aria-label="Aluguel mensal" placeholder="Aluguel mensal (vazio = sob consulta)" value="${money('rent_price')}" data-money></div>
        <div class="field"><label for="p-condo">Condomínio (R$/mês)</label><input id="p-condo" name="condo_fee" inputmode="numeric" value="${money('condo_fee')}" data-money></div>
        <div class="field"><label for="p-iptu">IPTU (R$/mês)</label><input id="p-iptu" name="iptu_monthly" inputmode="numeric" value="${money('iptu_monthly')}" data-money></div>
      </div>${id && guarded.has('sale_price') ? '<p class="muted form-note">Preços e finalidade alterados por corretor são enviados para aprovação do administrador.</p>' : ''}</section>

      <section class="card"><h2>Localização</h2><div class="form-grid">
        <div class="field"><label for="p-neighborhood">Bairro *</label><input id="p-neighborhood" name="neighborhood" value="${val('neighborhood')}" list="neighborhoods" required></div>
        <div class="field"><label for="p-condominium">Condomínio / edifício</label><input id="p-condominium" name="condominium" value="${val('condominium')}"></div>
        <div class="field"><label for="p-city">Cidade</label><input id="p-city" name="city" value="${val('city')}"></div>
        <div class="field"><label for="p-state">UF</label><input id="p-state" name="state" value="${val('state')}" maxlength="2"></div>
      </div>
      <h3>Endereço completo <span class="muted">(uso interno, não aparece no site)</span></h3>
      <div class="form-grid">
        <div class="field"><label for="p-zip">CEP</label><input id="p-zip" name="zip_code" inputmode="numeric" value="${esc(formatCep(current.zip_code || ''))}" placeholder="00000-000"></div>
        <div class="field"><label for="p-address">Rua</label><input id="p-address" name="address" value="${val('address')}"></div>
        <div class="field"><label for="p-number">Número</label><input id="p-number" name="address_number" value="${val('address_number')}"></div>
        <div class="field"><label for="p-complement">Complemento</label><input id="p-complement" name="address_complement" value="${val('address_complement')}"></div>
      </div><datalist id="neighborhoods">${[...SERVICE_AREAS.primary, ...SERVICE_AREAS.secondary].map((name) => `<option value="${esc(name)}">`).join('')}</datalist></section>

      <section class="card"><h2>Características</h2><div class="form-grid form-grid-3">
        ${[['bedrooms', 'Dormitórios'], ['suites', 'Suítes'], ['bathrooms', 'Banheiros'], ['parking', 'Vagas']].map(([field, label]) => `<div class="field"><label for="p-${field}">${label}</label><input id="p-${field}" name="${field}" type="number" min="0" max="99" value="${number(field)}"></div>`).join('')}
        <div class="field"><label for="p-area">Área útil (m²)</label><input id="p-area" name="area_m2" type="number" min="0" step="0.01" value="${number('area_m2')}"></div>
        <div class="field"><label for="p-land">Área do terreno (m²)</label><input id="p-land" name="land_area_m2" type="number" min="0" step="0.01" value="${number('land_area_m2')}"></div>
      </div></section>

      <section class="card"><h2>Situação e publicação</h2><div class="form-grid">
        <div class="field"><label for="p-status">Situação${lock('status')}</label><select id="p-status" name="status">${statusOptions}</select></div>
        <div class="field"><label for="p-responsible">Corretor responsável</label>${responsibleField}</div>
        <label class="check-inline"><input type="checkbox" name="published"${checked('published')}> Publicado no site${lock('published')}</label>
        <label class="check-inline"><input type="checkbox" name="featured"${checked('featured')}> Destaque na home${lock('featured')}</label>
      </div>${!ctx.isAdmin && !id ? '<p class="muted form-note">Ao marcar "Publicado" ou "Destaque", o imóvel é cadastrado e a publicação é enviada para aprovação do administrador.</p>' : ''}</section>
    </fieldset>
    ${canEdit ? `<div class="form-actions sticky-actions"><button class="btn btn-primary" type="submit">${id ? 'Salvar alterações' : 'Cadastrar imóvel'}</button><a class="btn btn-secondary" href="#/imoveis">Cancelar</a></div>` : ''}
    </form>
    ${id ? ownersBlock(property, owners, ctx, canEdit) : ''}`;

  bindPropertyForm(view, ctx, id, current);
  if (id) bindOwnersBlock(view, ctx, property);
  bindPendingBlock(view, ctx, id);
  if (id) await mountPhotoManager(view.querySelector('[data-photos]'), { ctx, propertyId: id, canEdit });

  const feedback = view.querySelector('[data-feedback]');
  const archiveButton = view.querySelector('[data-archive]');
  if (archiveButton) bindConfirmButton(archiveButton, async () => {
    try {
      if (ctx.isAdmin) {
        await propertiesRepository.update(id, { archived_at: new Date().toISOString(), published: false });
        ctx.flash('Imóvel arquivado. Ele saiu do site e só aparece com o filtro "Arquivados".');
        ctx.navigate('/imoveis');
      } else {
        await changeRequestsRepository.request('property', id, 'archive');
        ctx.flash('Arquivamento enviado para aprovação do administrador.');
        ctx.navigate(`/imoveis/${id}`, { replace: true });
      }
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  });
  const deleteButton = view.querySelector('[data-delete]');
  if (deleteButton) bindConfirmButton(deleteButton, async () => {
    try {
      await propertiesRepository.remove(id);
      ctx.flash('Imóvel excluído.');
      ctx.navigate('/imoveis');
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  });
}

/** Lê o formulário no formato do banco. */
function readForm(form, ctx) {
  const row = {};
  for (const field of PROPERTY_FIELDS) {
    const input = form.elements[field];
    if (!input) continue;
    if (BOOLEAN_FIELDS.includes(field)) row[field] = input.checked;
    else if (MONEY_FIELDS.includes(field)) row[field] = parseMoney(input.value);
    else if (NUMBER_FIELDS.includes(field)) row[field] = input.value === '' ? null : Number(input.value);
    else if (field === 'zip_code') row[field] = onlyDigits(input.value) || null;
    else row[field] = input.value.trim() || null;
  }
  if (row.code) row.code = row.code.toUpperCase();
  if (row.state) row.state = row.state.toUpperCase();
  if (!ctx.isAdmin) delete row.responsible_user_id;
  return row;
}

function validate(row) {
  if (!row.title || row.title.length < 3) return 'Informe o título do imóvel.';
  if (!row.type) return 'Selecione o tipo do imóvel.';
  if (!row.for_sale && !row.for_rent) return 'Marque se o imóvel está à venda, para locação ou ambos.';
  if (!row.neighborhood) return 'Informe o bairro.';
  if (row.code && !/^[A-Z0-9-]{2,30}$/.test(row.code)) return 'O código aceita letras, números e hífen (ex.: IS-0142).';
  if (row.suites !== null && row.bedrooms !== null && row.suites > row.bedrooms) return 'O número de suítes não pode ser maior que o de dormitórios.';
  return '';
}

function bindPropertyForm(view, ctx, id, original) {
  const form = view.querySelector('[data-property-form]');
  const feedback = view.querySelector('[data-feedback]');
  form.querySelectorAll('[data-money]').forEach((input) => input.addEventListener('input', () => { input.value = formatMoneyInput(input.value); }));
  const zip = form.elements.zip_code;
  zip.addEventListener('input', async () => {
    zip.value = formatCep(zip.value);
    const cep = onlyDigits(zip.value);
    if (cep.length !== 8) return;
    try {
      const result = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (result.erro) return;
      const fill = (name, value) => { if (value && !form.elements[name].value) form.elements[name].value = value; };
      fill('address', result.logradouro); fill('neighborhood', result.bairro); fill('city', result.localidade); fill('state', result.uf);
    } catch { /* a busca de CEP é só uma conveniência */ }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const row = readForm(form, ctx);
    const problem = validate(row);
    if (problem) { feedback.innerHTML = alertBox(problem); feedback.scrollIntoView({ block: 'center' }); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      if (!id) await createProperty(row, ctx);
      else await saveChanges(id, row, original, ctx);
    } catch (error) {
      feedback.innerHTML = alertBox(error?.code === '23505' ? 'Já existe um imóvel com este código.' : errorMessage(error));
      feedback.scrollIntoView({ block: 'center' });
    } finally {
      button.disabled = false;
    }
  });
}

async function createProperty(row, ctx) {
  const wantsPublication = !ctx.isAdmin && (row.published || row.featured);
  if (!row.code) delete row.code;
  const created = await propertiesRepository.create(ctx.agency.id, row);
  if (wantsPublication) {
    const payload = {};
    if (row.published) payload.published = true;
    if (row.featured) payload.featured = true;
    await changeRequestsRepository.request('property', created.id, 'update', payload, 'Publicação de imóvel novo');
    ctx.flash(`Imóvel ${created.code} cadastrado. A publicação foi enviada para aprovação do administrador.`);
  } else {
    ctx.flash(`Imóvel ${created.code} cadastrado.`);
  }
  ctx.navigate(`/imoveis/${created.id}`);
}

async function saveChanges(id, row, original, ctx) {
  const same = (a, b) => (a ?? null) === (b ?? null) || (a !== null && b !== null && Number(a) === Number(b) && typeof a !== 'boolean');
  const changed = Object.keys(row).filter((field) => !same(row[field], original[field]));
  if (!changed.length) { ctx.flash('Nenhuma alteração para salvar.'); ctx.navigate(`/imoveis/${id}`, { replace: true }); return; }
  const guarded = new Set(ctx.isAdmin ? [] : protectedFields(ctx));
  const direct = Object.fromEntries(changed.filter((field) => !guarded.has(field)).map((field) => [field, row[field]]));
  const needsApproval = Object.fromEntries(changed.filter((field) => guarded.has(field)).map((field) => [field, row[field]]));
  if (Object.keys(direct).length) await propertiesRepository.update(id, direct);
  if (Object.keys(needsApproval).length) await changeRequestsRepository.request('property', id, 'update', needsApproval);
  const messages = [];
  if (Object.keys(direct).length) messages.push('Alterações salvas.');
  if (Object.keys(needsApproval).length) messages.push(`Enviado para aprovação: ${Object.keys(needsApproval).map((field) => FIELD_LABELS[field]).join(', ')}.`);
  ctx.flash(messages.join(' '));
  ctx.navigate(`/imoveis/${id}`, { replace: true });
}

// ---------------------------------------------------------------------------
// Solicitações pendentes do imóvel
// ---------------------------------------------------------------------------

export function describeChanges(request, current, team) {
  if (request.action === 'archive') return '<li>Arquivar o imóvel (sai do site)</li>';
  if (request.action === 'delete') return '<li>Excluir o imóvel</li>';
  return Object.entries(request.payload).map(([field, value]) => `<li><strong>${esc(FIELD_LABELS[field] || field)}:</strong> ${esc(describeValue(field, current?.[field], team))} → <strong>${esc(describeValue(field, value, team))}</strong></li>`).join('');
}

function pendingBlock(pending, current, ctx) {
  if (!pending.length) return '';
  const items = pending.map((request) => `<div class="pending-item" data-request="${request.id}"><div><p><strong>${esc(memberName(ctx.team, request.requested_by))}</strong> · ${formatDateTime(request.requested_at)}${request.reason ? ` · ${esc(request.reason)}` : ''}</p><ul class="change-list">${describeChanges(request, current, ctx.team)}</ul></div><div class="pending-actions">${ctx.isAdmin ? '<button class="btn btn-primary" type="button" data-approve>Aprovar</button><button class="btn btn-secondary" type="button" data-reject>Rejeitar</button>' : request.requested_by === ctx.user.id ? '<button class="btn btn-secondary" type="button" data-cancel>Cancelar solicitação</button>' : ''}</div></div>`).join('');
  return `<section class="card card-pending"><h2>Aguardando aprovação</h2>${items}</section>`;
}

function bindPendingBlock(view, ctx, id) {
  const feedback = view.querySelector('[data-feedback]');
  view.querySelectorAll('[data-request]').forEach((item) => {
    const requestId = item.dataset.request;
    const run = async (action, message) => {
      item.querySelectorAll('button').forEach((button) => { button.disabled = true; });
      try {
        await action();
        ctx.flash(message);
        await ctx.refreshBadges();
        ctx.navigate(`/imoveis/${id}`, { replace: true });
      } catch (error) {
        feedback.innerHTML = alertBox(errorMessage(error));
        item.querySelectorAll('button').forEach((button) => { button.disabled = false; });
      }
    };
    item.querySelector('[data-approve]')?.addEventListener('click', () => run(() => changeRequestsRepository.review(requestId, true), 'Solicitação aprovada e aplicada.'));
    item.querySelector('[data-reject]')?.addEventListener('click', () => run(() => changeRequestsRepository.review(requestId, false), 'Solicitação rejeitada.'));
    item.querySelector('[data-cancel]')?.addEventListener('click', () => run(() => changeRequestsRepository.cancel(requestId), 'Solicitação cancelada.'));
  });
}

// ---------------------------------------------------------------------------
// Proprietários do imóvel
// ---------------------------------------------------------------------------

function ownersBlock(property, owners, ctx, canEdit) {
  const linked = property.property_owners;
  const linkedIds = new Set(linked.map((link) => link.owner_id));
  const available = owners.filter((owner) => !linkedIds.has(owner.id) && owner.status === 'active');
  const rows = linked.map((link) => `<tr><td><a href="#/proprietarios/${link.owner_id}">${esc(link.owners?.contacts?.name || '—')}</a></td><td>${esc(displayPhone(link.owners?.contacts?.phone))}</td><td>${esc(memberName(ctx.team, link.owners?.responsible_user_id))}</td><td>${link.share_percent ? `${link.share_percent}%` : '—'}</td><td>${canEdit ? `<button class="link-button" type="button" data-unlink="${link.owner_id}">Remover</button>` : ''}</td></tr>`).join('');
  const form = canEdit
    ? available.length
      ? `<form class="inline-form" data-link-owner><div class="field"><label for="link-owner">Proprietário</label><select id="link-owner" name="owner" required>${available.map((owner) => `<option value="${owner.id}">${esc(owner.contacts.name)}</option>`).join('')}</select></div><div class="field field-small"><label for="link-share">Participação (%)</label><input id="link-share" name="share" type="number" min="1" max="100" step="0.01" placeholder="opcional"></div><button class="btn btn-secondary" type="submit">Vincular</button></form>`
      : `<p class="muted">${owners.length ? 'Todos os proprietários da sua carteira já estão vinculados.' : 'Nenhum proprietário na sua carteira.'} <a href="#/contatos/novo?proprietario=1">Cadastrar proprietário</a></p>`
    : '';
  const hiddenNote = ctx.isAdmin ? '' : '<p class="muted form-note">Proprietários da carteira de outros corretores não aparecem para você.</p>';
  return `<section class="card"><h2>Proprietários</h2>${linked.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Nome</th><th>Telefone</th><th>Responsável</th><th>Participação</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">Nenhum proprietário vinculado.</p>'}${hiddenNote}${form}</section>`;
}

function bindOwnersBlock(view, ctx, property) {
  const feedback = view.querySelector('[data-feedback]');
  const form = view.querySelector('[data-link-owner]');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const share = form.share.value ? Number(form.share.value) : null;
    try {
      await propertiesRepository.linkOwner(ctx.agency.id, property.id, form.owner.value, share);
      ctx.flash('Proprietário vinculado.');
      ctx.navigate(`/imoveis/${property.id}`, { replace: true });
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  });
  view.querySelectorAll('[data-unlink]').forEach((button) => bindConfirmButton(button, async () => {
    try {
      await propertiesRepository.unlinkOwner(property.id, button.dataset.unlink);
      ctx.flash('Vínculo removido.');
      ctx.navigate(`/imoveis/${property.id}`, { replace: true });
    } catch (error) { feedback.innerHTML = alertBox(errorMessage(error)); }
  }));
}
