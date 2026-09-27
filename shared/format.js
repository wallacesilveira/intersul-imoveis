/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Formatação e segurança de saída, compartilhadas entre o site público e o painel. */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa qualquer valor antes de interpolá-lo em HTML. Todo dado vindo do banco deve passar por aqui. */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Remove acentos e caixa para buscas: "Bolsão" casa com "bolsao". */
export function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

const integerFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

/** 2800000 → "R$ 2.800.000". Valores com centavos mantêm os centavos. */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  const formatter = Number.isInteger(number) ? integerFormatter : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `R$ ${formatter.format(number)}`;
}

/** 2072 → "2.072 m²" */
export function formatArea(value) {
  if (value === null || value === undefined || value === '') return '';
  return `${decimalFormatter.format(Number(value))} m²`;
}

/** Máscara de telefone brasileiro: (11) 5521-7444 / (11) 99999-9999 */
export function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
