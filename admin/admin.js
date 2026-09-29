/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Painel: sessão, estrutura (menu) e rotas. As permissões são aplicadas pelo banco; o painel só adapta a interface. */
import { ROLE_LABELS, alertBox, errorMessage, esc } from './lib/ui.js';
import { changeRequestsRepository } from './repositories/change-requests.js';
import { approvalsPage } from './pages/approvals.js';
import { dashboardPage } from './pages/dashboard.js';
import { memberPage, teamListPage } from './pages/team.js';
import { contactDetailPage, contactFormPage, contactsListPage } from './pages/contacts.js';
import { leadDetailPage, leadFormPage, leadsListPage } from './pages/leads.js';
import { leadsRepository } from './repositories/leads.js';
import { renderLogin, renderNewPassword, renderNoAccess } from './pages/login.js';
import { ownerDetailPage, ownersListPage } from './pages/owners.js';
import { propertiesListPage, propertyFormPage } from './pages/properties.js';
import { sessionRepository } from './repositories/session.js';

const root = document.querySelector('#app');
const DEFAULT_ROUTE = '/painel';

const routes = [
  [/^\/painel$/, dashboardPage],
  [/^\/equipe$/, teamListPage],
  [/^\/equipe\/([0-9a-f-]{36})$/, memberPage],
  [/^\/imoveis$/, propertiesListPage],
  [/^\/imoveis\/novo$/, propertyFormPage],
  [/^\/imoveis\/([0-9a-f-]{36})$/, propertyFormPage],
  [/^\/aprovacoes$/, approvalsPage],
  [/^\/leads$/, leadsListPage],
  [/^\/leads\/novo$/, leadFormPage],
  [/^\/leads\/([0-9a-f-]{36})$/, leadDetailPage],
  [/^\/contatos$/, contactsListPage],
  [/^\/contatos\/novo$/, contactFormPage],
  [/^\/contatos\/([0-9a-f-]{36})\/editar$/, contactFormPage],
  [/^\/contatos\/([0-9a-f-]{36})$/, contactDetailPage],
  [/^\/proprietarios$/, ownersListPage],
  [/^\/proprietarios\/([0-9a-f-]{36})$/, ownerDetailPage],
];

const menu = [
  { path: '/painel', label: 'Início' },
  { path: '/leads', label: 'Leads', badge: 'leads' },
  { path: '/imoveis', label: 'Imóveis' },
  { path: '/contatos', label: 'Contatos' },
  { path: '/proprietarios', label: 'Proprietários' },
  { path: '/aprovacoes', label: 'Aprovações', agentLabel: 'Minhas solicitações', badge: 'pending' },
  { path: '/equipe', label: 'Equipe', adminOnly: true },
];

let ctx = null;
let flashMessage = '';
let recovering = false;

function createContext(user, membership, team) {
  return {
    user,
    member: membership,
    agency: membership.agencies,
    team,
    isAdmin: membership.role === 'admin',
    navigate(path, { replace = false } = {}) {
      const target = `#${path}`;
      if (window.location.hash === target) { renderRoute(); return; }
      if (replace) { history.replaceState(null, '', target); renderRoute(); return; }
      window.location.hash = target;
    },
    flash(message) { flashMessage = message; },
    /** Recarrega a equipe (nomes usados em todo o painel) depois de alterações em Equipe. */
    async reloadTeam() { this.team = await sessionRepository.team(this.agency.id); },
    /** Atualiza os contadores do menu: leads novos (todos) e solicitações pendentes (admin). */
    async refreshBadges() {
      const counters = { leads: () => leadsRepository.countNew(this.agency.id) };
      if (this.isAdmin) counters.pending = () => changeRequestsRepository.countPending(this.agency.id);
      await Promise.all(Object.entries(counters).map(async ([name, count]) => {
        const badge = root.querySelector(`[data-badge="${name}"]`);
        if (!badge) return;
        try { const value = await count(); badge.textContent = value || ''; badge.hidden = !value; } catch { badge.hidden = true; }
      }));
    },
    takeFlash() { const message = flashMessage; flashMessage = ''; return alertBox(message, 'success'); },
  };
}

function currentPath() {
  const hash = window.location.hash.replace(/^#/, '');
  // links de recuperação de senha chegam com tokens no fragmento; não são rotas
  if (!hash.startsWith('/')) return DEFAULT_ROUTE;
  return hash.split('?')[0] || DEFAULT_ROUTE;
}

function renderShell() {
  root.innerHTML = `<div class="admin-layout">
    <aside class="sidebar">
      <a class="sidebar-brand" href="#${DEFAULT_ROUTE}"><img src="../Logo_branco.png" alt=""><span><strong>INTERSUL</strong><small>Painel</small></span></a>
      <nav class="sidebar-nav" aria-label="Menu do painel">${menu.filter((item) => ctx.isAdmin || !item.adminOnly).map((item) => `<a href="#${item.path}" data-path="${item.path}">${ctx.isAdmin || !item.agentLabel ? item.label : item.agentLabel}${item.badge ? `<span class="nav-badge" data-badge="${item.badge}" hidden></span>` : ''}</a>`).join('')}<a href="../" target="_blank" rel="noreferrer">Ver site ↗</a></nav>
      <div class="sidebar-user"><strong>${esc(ctx.member.full_name)}</strong><span>${ROLE_LABELS[ctx.member.role]} · ${esc(ctx.agency.name)}</span><button class="link-button" type="button" data-sign-out>Sair</button></div>
    </aside>
    <main class="admin-main" id="view" tabindex="-1"></main>
  </div>`;
  root.querySelector('[data-sign-out]').addEventListener('click', signOut);
}

async function renderRoute() {
  if (!ctx) return;
  if (!root.querySelector('#view')) renderShell();
  const view = root.querySelector('#view');
  const path = currentPath();
  const match = routes.map(([pattern, page]) => [path.match(pattern), page]).find(([result]) => result);
  if (!match) { ctx.navigate(DEFAULT_ROUTE, { replace: true }); return; }
  root.querySelectorAll('.sidebar-nav [data-path]').forEach((link) => link.classList.toggle('active', path.startsWith(link.dataset.path)));
  view.innerHTML = '<div class="loading">Carregando…</div>';
  try {
    const [result, page] = match;
    await page(view, ctx, ...result.slice(1));
  } catch (error) {
    view.innerHTML = alertBox(errorMessage(error));
  }
  flashMessage = ''; // um aviso vale só para a tela seguinte, mesmo que ela não o exiba
  window.scrollTo(0, 0);
}

async function enter(user) {
  const memberships = await sessionRepository.memberships(user.id);
  if (!memberships.length) { renderNoAccess(root, { onSignOut: signOut }); return; }
  const membership = memberships[0];
  const team = await sessionRepository.team(membership.agency_id);
  ctx = createContext(user, membership, team);
  renderShell();
  ctx.refreshBadges();
  await renderRoute();
}

async function signOut() {
  await sessionRepository.signOut();
  ctx = null;
  history.replaceState(null, '', window.location.pathname);
  renderLogin(root, { onSignedIn: enter });
}

// Linhas de tabela clicáveis
root.addEventListener('click', (event) => {
  const row = event.target.closest('tr[data-href]');
  if (row && !event.target.closest('a, button')) window.location.hash = row.dataset.href;
});

window.addEventListener('hashchange', () => { if (!recovering) renderRoute(); });

/*
 * Links enviados por e-mail (recuperação de senha e convite) voltam com dados no fragmento da URL:
 *   #access_token=...&type=recovery|invite   → link válido
 *   #error=...&error_code=otp_expired         → link vencido ou já usado
 * O index.html guarda esse fragmento antes de o Supabase limpá-lo (window.__authRedirect).
 */
const AUTH_LINK_ERRORS = {
  otp_expired: 'O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
  access_denied: 'O link não é mais válido. Peça um novo em "Esqueci minha senha".',
};
const authRedirect = new URLSearchParams((window.__authRedirect || '').replace(/^#/, ''));

async function start() {
  const linkError = authRedirect.get('error_code') || authRedirect.get('error');
  const linkType = authRedirect.get('type');
  if (linkError || linkType) history.replaceState(null, '', window.location.pathname);
  if (linkError) {
    renderLogin(root, { onSignedIn: enter, message: AUTH_LINK_ERRORS[linkError] || 'Não foi possível validar o link. Peça um novo em "Esqueci minha senha".' });
    return;
  }
  const user = await sessionRepository.currentUser();
  if (user && (linkType === 'recovery' || linkType === 'invite')) {
    recovering = true;
    renderNewPassword(root, {
      invite: linkType === 'invite',
      onDone: async () => { recovering = false; await enter(user); },
    });
    return;
  }
  if (user) await enter(user); else renderLogin(root, { onSignedIn: enter });
}

start().catch((error) => {
  root.innerHTML = `<main class="auth-screen"><section class="auth-card">${alertBox(errorMessage(error))}</section></main>`;
});
