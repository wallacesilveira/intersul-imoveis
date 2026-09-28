/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Início do painel: o que precisa de ação agora. O banco já restringe o corretor à carteira dele. */
import { supabase } from '../../shared/supabase-client.js';
import { PROPERTY_STATUS } from '../../shared/property-model.js';
import { esc, formatDate, formatDateTime, memberName } from '../lib/ui.js';
import { FIELD_LABELS, describeValue } from './properties.js';

const STALE_DAYS = 3;
const LIST_LIMIT = 5;
const DAY = 86400000;
const unwrap = ({ data, error }) => { if (error) throw error; return data; };

async function loadData(ctx) {
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const [openLeads, weekLeads, properties, requests] = await Promise.all([
    supabase.from('leads').select('id, status, assigned_to, created_at, contacts (name), properties (code), lead_activities (created_at)')
      .eq('agency_id', ctx.agency.id).in('status', ['new', 'in_progress']).order('created_at', { ascending: false }).limit(500).then(unwrap),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', ctx.agency.id).gte('created_at', since)
      .then(({ count, error }) => { if (error) throw error; return count || 0; }),
    supabase.from('properties').select('id, code, title, status, published, description, for_sale, sale_price, for_rent, rent_price, responsible_user_id, created_at, property_photos (id)')
      .eq('agency_id', ctx.agency.id).is('archived_at', null).order('created_at', { ascending: false }).limit(1000).then(unwrap),
    supabase.from('change_requests').select('*').eq('agency_id', ctx.agency.id).eq('status', 'pending').order('requested_at').then(unwrap),
  ]);
  return { openLeads, weekLeads, properties, requests };
}

/** Problemas que deixam um imóvel publicado com aparência incompleta no site. */
function propertyIssues(property) {
  const issues = [];
  if (!property.property_photos.length) issues.push('sem foto');
  if (!property.description?.trim()) issues.push('sem descrição');
  const hasPrice = (property.for_sale && property.sale_price !== null) || (property.for_rent && property.rent_price !== null);
  if (!hasPrice) issues.push('sem preço');
  return issues;
}

const lastActivity = (lead) => Math.max(new Date(lead.created_at).getTime(), ...lead.lead_activities.map((activity) => new Date(activity.created_at).getTime()));
/** Mesma regra do site: publicado, disponível ou reservado. */
const isOnSite = (property) => property.published && ['available', 'reserved'].includes(property.status);
const daysAgo = (time) => Math.floor((Date.now() - time) / DAY);

function actionCard({ title, count, emptyText, items, moreHref, moreLabel }) {
  const list = items.slice(0, LIST_LIMIT).join('');
  const more = count > LIST_LIMIT ? `<a class="link-button" href="${moreHref}">${moreLabel} (${count})</a>` : '';
  return `<section class="card action-card"><div class="section-head"><h2>${title}</h2>${count ? `<span class="count-pill">${count}</span>` : ''}</div>${count ? `<ul class="action-list">${list}</ul>${more}` : `<p class="all-clear">${emptyText}</p>`}</section>`;
}

const actionItem = (href, main, sub) => `<li><a href="${href}"><strong>${main}</strong><span>${sub}</span></a></li>`;

export async function dashboardPage(view, ctx) {
  const { openLeads, weekLeads, properties, requests } = await loadData(ctx);
  const mine = ctx.isAdmin ? properties : properties.filter((property) => property.responsible_user_id === ctx.user.id);

  const newLeads = openLeads.filter((lead) => lead.status === 'new' && (ctx.isAdmin ? !lead.assigned_to : true));
  const staleLeads = openLeads
    .filter((lead) => lead.status === 'in_progress' && daysAgo(lastActivity(lead)) >= STALE_DAYS)
    .sort((a, b) => lastActivity(a) - lastActivity(b));
  const withIssues = mine
    .filter((property) => isOnSite(property))
    .map((property) => ({ property, issues: propertyIssues(property) }))
    .filter(({ issues }) => issues.length);

  const stats = [
    { value: properties.filter((property) => property.status === 'available').length, label: 'Imóveis disponíveis', href: '#/imoveis?situacao=available' },
    { value: properties.filter((property) => isOnSite(property)).length, label: 'Publicados no site', href: '#/imoveis?site=sim' },
    { value: properties.filter((property) => ['sold', 'rented'].includes(property.status)).length, label: 'Vendidos ou alugados', href: '#/imoveis' },
    { value: weekLeads, label: ctx.isAdmin ? 'Leads nos últimos 7 dias' : 'Seus leads nos últimos 7 dias', href: '#/leads?situacao=' },
  ];

  const leadLine = (lead) => `${esc(lead.properties ? lead.properties.code : 'Sem imóvel')}${ctx.isAdmin && lead.assigned_to ? ` · ${esc(memberName(ctx.team, lead.assigned_to))}` : ''}`;
  const cards = [
    actionCard({
      title: ctx.isAdmin ? 'Leads novos sem responsável' : 'Seus leads novos',
      count: newLeads.length,
      emptyText: 'Nenhum lead novo aguardando.',
      items: newLeads.map((lead) => actionItem(`#/leads/${lead.id}`, esc(lead.contacts?.name || '—'), `${esc(lead.properties?.code || 'Sem imóvel')} · recebido em ${formatDateTime(lead.created_at)}`)),
      moreHref: ctx.isAdmin ? '#/leads?situacao=new&responsavel=none' : '#/leads?situacao=new',
      moreLabel: 'Ver todos',
    }),
    actionCard({
      title: `Leads sem retorno há ${STALE_DAYS}+ dias`,
      count: staleLeads.length,
      emptyText: 'Todos os atendimentos estão em dia.',
      items: staleLeads.map((lead) => actionItem(`#/leads/${lead.id}`, esc(lead.contacts?.name || '—'), `${leadLine(lead)} · último registro há ${daysAgo(lastActivity(lead))} dias`)),
      moreHref: '#/leads?situacao=in_progress',
      moreLabel: 'Ver em atendimento',
    }),
    actionCard({
      title: ctx.isAdmin ? 'Aprovações pendentes' : 'Suas solicitações em análise',
      count: requests.length,
      emptyText: ctx.isAdmin ? 'Nenhuma alteração aguardando aprovação.' : 'Nenhuma solicitação em análise.',
      items: requests.map((request) => {
        const property = properties.find((item) => item.id === request.entity_id);
        const target = request.entity === 'property' ? (property ? `${esc(property.code)} · ${esc(property.title)}` : 'Imóvel') : 'Proprietário';
        const summary = request.action === 'archive' ? 'arquivar' : request.action === 'delete' ? 'excluir'
          : Object.entries(request.payload).map(([field, value]) => `${FIELD_LABELS[field] || field}: ${describeValue(field, value, ctx.team)}`).join(', ');
        return actionItem('#/aprovacoes', target, `${esc(memberName(ctx.team, request.requested_by))} · ${esc(summary)}`);
      }),
      moreHref: '#/aprovacoes',
      moreLabel: 'Ver todas',
    }),
    actionCard({
      title: ctx.isAdmin ? 'Imóveis publicados incompletos' : 'Seus imóveis publicados incompletos',
      count: withIssues.length,
      emptyText: 'Todos os imóveis publicados têm foto, descrição e preço.',
      items: withIssues.map(({ property, issues }) => actionItem(`#/imoveis/${property.id}`, `${esc(property.code)} · ${esc(property.title)}`, esc(issues.join(', ')))),
      moreHref: '#/imoveis?site=sim',
      moreLabel: 'Ver publicados',
    }),
  ];

  const recent = properties.slice(0, LIST_LIMIT).map((property) => `<li><a href="#/imoveis/${property.id}"><strong>${esc(property.code)} · ${esc(property.title)}</strong><span>${PROPERTY_STATUS[property.status]} · ${isOnSite(property) ? 'no site' : 'fora do site'} · cadastrado em ${formatDate(property.created_at)}</span></a></li>`).join('');
  const today = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  view.innerHTML = `<header class="page-header"><div><h1>Olá, ${esc(ctx.member.full_name.split(' ')[0])}</h1><p class="muted">${today.charAt(0).toUpperCase()}${today.slice(1)} · ${ctx.isAdmin ? 'visão da imobiliária' : 'sua carteira'}</p></div></header>
    ${ctx.takeFlash()}
    <div class="stat-row">${stats.map((stat) => `<a class="stat-tile" href="${stat.href}"><strong>${stat.value}</strong><span>${stat.label}</span></a>`).join('')}</div>
    <div class="action-grid">${cards.join('')}</div>
    <section class="card action-card"><div class="section-head"><h2>Últimos imóveis cadastrados</h2><a class="link-button" href="#/imoveis">Ver todos</a></div>${recent ? `<ul class="action-list">${recent}</ul>` : '<p class="muted">Nenhum imóvel cadastrado.</p>'}</section>`;
}
