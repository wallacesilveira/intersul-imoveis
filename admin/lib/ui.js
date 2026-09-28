/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Utilitários de interface do painel: formatação, rótulos e mensagens de erro. */
import { escapeHtml, formatPhone, onlyDigits } from '../../shared/format.js';

export const esc = escapeHtml;

export const ROLE_LABELS = { admin: 'Administrador', agent: 'Corretor' };
export const OWNER_STATUS_LABELS = { active: 'Ativo', inactive: 'Inativo' };
export const LEAD_KIND_LABELS = { property_interest: 'Interesse em imóvel', owner_listing: 'Captação', general: 'Contato geral' };
export const LEAD_STATUS_LABELS = { new: 'Novo', in_progress: 'Em atendimento', won: 'Convertido', lost: 'Descartado' };

/** Telefone guardado só com dígitos → exibição. Números com código de país aparecem com "+". */
export function displayPhone(digits) {
  const value = onlyDigits(digits);
  if (!value) return '';
  return value.length <= 11 ? formatPhone(value) : `+${value}`;
}

export function whatsappLink(digits) {
  const value = onlyDigits(digits);
  if (!value) return '';
  return `https://wa.me/${value.length <= 11 ? `55${value}` : value}`;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const formatDate = (value) => (value ? dateFormatter.format(new Date(value)) : '');
export const formatDateTime = (value) => (value ? dateTimeFormatter.format(new Date(value)) : '');

export function memberName(team, userId) {
  return team.find((member) => member.user_id === userId)?.full_name || '—';
}

/** Parâmetros depois do "?" na rota (#/contatos?q=joao). */
export function routeQuery() {
  return new URLSearchParams(window.location.hash.split('?')[1] || '');
}

/** Traduz erros do banco/autenticação em mensagens para o usuário. Detalhes técnicos vão para o console. */
export function errorMessage(error) {
  console.error(error);
  const message = error?.message || '';
  if (message === 'approval_required') return 'Essa alteração precisa de aprovação do administrador.';
  if (message === 'Invalid login credentials') return 'E-mail ou senha incorretos.';
  if (message === 'Email not confirmed') return 'Este e-mail ainda não foi confirmado.';
  if (error?.code === '23505') return 'Já existe um cadastro com esses dados.';
  if (error?.code === '23503') return 'Este registro está ligado a outros dados e não pode ser removido.';
  if (error?.code === '23514') return 'Confira os dados informados.';
  if (error?.code === '42501' || /row-level security/i.test(message)) return 'Você não tem permissão para esta ação.';
  const detail = [error?.code, message].filter(Boolean).join(' · ');
  return `Não foi possível concluir a operação. Tente novamente.${detail ? ` (detalhe técnico: ${detail.slice(0, 160)})` : ''}`;
}

export function alertBox(message, kind = 'error') {
  return message ? `<div class="alert alert-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${esc(message)}</div>` : '';
}

export function emptyState(message) {
  return `<div class="empty-state">${esc(message)}</div>`;
}

/** Botão de exclusão em dois cliques (o painel não usa confirm() do navegador). */
export function bindConfirmButton(button, onConfirm) {
  const original = button.textContent;
  let armed = false;
  button.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      button.textContent = 'Clique para confirmar';
      button.classList.add('is-armed');
      setTimeout(() => { if (armed) { armed = false; button.textContent = original; button.classList.remove('is-armed'); } }, 4000);
      return;
    }
    armed = false;
    button.disabled = true;
    try { await onConfirm(); } finally { button.disabled = false; button.textContent = original; button.classList.remove('is-armed'); }
  });
}
