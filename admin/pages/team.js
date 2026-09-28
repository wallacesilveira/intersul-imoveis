/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Equipe (somente admin): membros, papéis, desativação e transferência de carteira. */
import { formatPhone, onlyDigits } from '../../shared/format.js';
import { supabase } from '../../shared/supabase-client.js';
import { ROLE_LABELS, alertBox, emptyState, errorMessage, esc, formatDateTime } from '../lib/ui.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const TEAM_ERRORS = {
  last_admin: 'A imobiliária precisa de pelo menos um administrador ativo.',
  user_not_found: 'Não existe login com este e-mail. Crie o usuário no Supabase (Authentication → Users → Add user) e tente de novo.',
  already_member: 'Esta pessoa já faz parte da equipe.',
  invalid_name: 'Informe o nome.',
  target_not_active: 'Escolha um membro ativo para receber a carteira.',
  same_member: 'Escolha outra pessoa para receber a carteira.',
};
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const portfolioText = (item) => `${plural(item.owners, 'proprietário', 'proprietários')} · ${plural(item.properties, 'imóvel', 'imóveis')} · ${plural(item.open_leads, 'lead aberto', 'leads abertos')}`;
const teamError = (error) => TEAM_ERRORS[error?.message] || errorMessage(error);
const listTeam = (agencyId) => supabase.rpc('list_team', { p_agency: agencyId }).then(unwrap);

export async function teamListPage(view, ctx) {
  if (!ctx.isAdmin) { view.innerHTML = emptyState('Somente administradores gerenciam a equipe.'); return; }
  const team = await listTeam(ctx.agency.id);
  const rows = team.map((member) => `<tr data-href="#/equipe/${member.user_id}"><td><a href="#/equipe/${member.user_id}">${esc(member.full_name)}</a>${member.user_id === ctx.user.id ? ' <span class="badge">você</span>' : ''}<div class="cell-sub">${esc(member.email)}</div></td><td>${ROLE_LABELS[member.role]}</td><td>${member.active ? '<span class="badge badge-green">Ativo</span>' : '<span class="badge">Inativo</span>'}</td><td>${portfolioText(member)}</td><td>${member.last_sign_in_at ? formatDateTime(member.last_sign_in_at) : '<span class="muted">nunca entrou</span>'}</td></tr>`).join('');

  view.innerHTML = `<header class="page-header"><div><h1>Equipe</h1><p class="muted">Quem acessa o painel da ${esc(ctx.agency.name)}.</p></div></header>
    ${ctx.takeFlash()}<div data-feedback></div>
    <div class="card table-card"><table class="data-table"><thead><tr><th>Nome</th><th>Papel</th><th>Situação</th><th>Carteira</th><th>Último acesso</th></tr></thead><tbody>${rows}</tbody></table></div>
    <section class="card"><h2>Adicionar à equipe</h2>
      <p class="muted form-note">1. Crie o login no Supabase em <strong>Authentication → Users → Add user</strong> (e-mail e senha provisória). 2. Informe o mesmo e-mail aqui.</p>
      <form class="inline-form" data-add-member>
        <div class="field"><label for="m-email">E-mail do login</label><input id="m-email" name="email" type="email" required></div>
        <div class="field"><label for="m-name">Nome</label><input id="m-name" name="name" required></div>
        <div class="field field-small"><label for="m-role">Papel</label><select id="m-role" name="role"><option value="agent">Corretor</option><option value="admin">Administrador</option></select></div>
        <button class="btn btn-primary" type="submit">Adicionar</button>
      </form>
    </section>`;

  const form = view.querySelector('[data-add-member]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      unwrap(await supabase.rpc('add_member_by_email', { p_agency: ctx.agency.id, p_email: form.email.value.trim(), p_full_name: form.name.value.trim(), p_role: form.role.value }));
      await ctx.reloadTeam();
      ctx.flash(`${form.name.value.trim()} foi adicionado(a) à equipe.`);
      ctx.navigate('/equipe', { replace: true });
    } catch (error) { view.querySelector('[data-feedback]').innerHTML = alertBox(teamError(error)); }
  });
}

export async function memberPage(view, ctx, userId) {
  if (!ctx.isAdmin) { view.innerHTML = emptyState('Somente administradores gerenciam a equipe.'); return; }
  const team = await listTeam(ctx.agency.id);
  const member = team.find((item) => item.user_id === userId);
  if (!member) { view.innerHTML = emptyState('Membro não encontrado.'); return; }
  const isSelf = member.user_id === ctx.user.id;
  const targets = team.filter((item) => item.active && item.user_id !== userId);
  const hasPortfolio = member.owners + member.properties + member.open_leads > 0;

  view.innerHTML = `<header class="page-header"><div><a class="back-link" href="#/equipe">← Equipe</a><h1>${esc(member.full_name)}</h1><p class="muted">${esc(member.email)} · ${member.last_sign_in_at ? `último acesso em ${formatDateTime(member.last_sign_in_at)}` : 'ainda não entrou no painel'}</p></div></header>
    ${ctx.takeFlash()}<div data-feedback></div>
    <div class="detail-columns">
      <form class="card stack" data-member-form><h2>Dados e acesso</h2>
        <div class="field"><label for="mb-name">Nome</label><input id="mb-name" name="full_name" value="${esc(member.full_name)}" required></div>
        <div class="field"><label for="mb-phone">Telefone</label><input id="mb-phone" name="phone" type="tel" inputmode="tel" maxlength="15" value="${esc(member.phone ? formatPhone(member.phone) : '')}"></div>
        <div class="field"><label for="mb-role">Papel</label><select id="mb-role" name="role">${Object.entries(ROLE_LABELS).map(([value, label]) => `<option value="${value}"${value === member.role ? ' selected' : ''}>${label}</option>`).join('')}</select></div>
        <label class="check-inline"><input type="checkbox" name="active"${member.active ? ' checked' : ''}${isSelf ? ' disabled' : ''}> Acesso ao painel ativo</label>
        ${isSelf ? '<p class="muted form-note">Você não pode desativar o seu próprio acesso.</p>' : '<p class="muted form-note">Ao desativar, a pessoa perde o acesso na hora. Leads, imóveis e anotações dela são mantidos; transfira a carteira abaixo.</p>'}
        <button class="btn btn-primary" type="submit">Salvar</button>
      </form>
      <section class="card stack"><h2>Carteira</h2>
        <p>${portfolioText(member)}</p>
        ${hasPortfolio && targets.length ? `<form class="stack" data-transfer><div class="field"><label for="mb-target">Transferir tudo para</label><select id="mb-target" name="target">${targets.map((item) => `<option value="${item.user_id}">${esc(item.full_name)}</option>`).join('')}</select></div><button class="btn btn-secondary" type="submit">Transferir carteira</button><p class="muted form-note">Leads convertidos ou descartados continuam no histórico de quem atendeu.</p></form>` : `<p class="muted">${hasPortfolio ? 'Não há outro membro ativo para receber a carteira.' : 'Nada sob a responsabilidade desta pessoa.'}</p>`}
      </section>
    </div>`;

  const feedback = view.querySelector('[data-feedback]');
  const form = view.querySelector('[data-member-form]');
  form.phone.addEventListener('input', () => { form.phone.value = formatPhone(form.phone.value); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const patch = { full_name: form.full_name.value.trim(), phone: onlyDigits(form.phone.value) || null, role: form.role.value };
    if (!isSelf) patch.active = form.active.checked;
    if (patch.full_name.length < 2) { feedback.innerHTML = alertBox('Informe o nome.'); return; }
    try {
      const rows = unwrap(await supabase.from('agency_members').update(patch).eq('agency_id', ctx.agency.id).eq('user_id', userId).select('user_id'));
      if (!rows.length) throw Object.assign(new Error('forbidden'), { code: '42501' });
      await ctx.reloadTeam();
      ctx.flash('Dados atualizados.');
      ctx.navigate(`/equipe/${userId}`, { replace: true });
    } catch (error) { feedback.innerHTML = alertBox(teamError(error)); }
  });

  const transfer = view.querySelector('[data-transfer]');
  transfer?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const target = transfer.target.value;
    try {
      const moved = unwrap(await supabase.rpc('transfer_portfolio', { p_agency: ctx.agency.id, p_from: userId, p_to: target }));
      ctx.flash(`Carteira transferida para ${team.find((item) => item.user_id === target).full_name}: ${plural(moved.owners, 'proprietário', 'proprietários')}, ${plural(moved.properties, 'imóvel', 'imóveis')} e ${plural(moved.leads, 'lead', 'leads')}.`);
      ctx.refreshBadges();
      ctx.navigate(`/equipe/${userId}`, { replace: true });
    } catch (error) { feedback.innerHTML = alertBox(teamError(error)); }
  });
}
