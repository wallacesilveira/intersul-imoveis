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

/** Máscara de CPF (até 11 dígitos) ou CNPJ (12 a 14 dígitos). */
export function formatDocument(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function checkDigit(digits, weights) {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Confere os dígitos verificadores de um CPF (11 dígitos) ou CNPJ (14 dígitos). */
export function isValidDocument(value) {
  const digits = onlyDigits(value);
  if (/^(\d)\1+$/.test(digits)) return false;
  if (digits.length === 11) {
    return checkDigit(digits, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[9])
      && checkDigit(digits, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[10]);
  }
  if (digits.length === 14) {
    return checkDigit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12])
      && checkDigit(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13]);
  }
  return false;
}

/** Máscara de valor em reais inteiros enquanto se digita: "2800000" → "2.800.000". */
export function formatMoneyInput(value) {
  const digits = onlyDigits(value).replace(/^0+(?=\d)/, '').slice(0, 12);
  return digits ? integerFormatter.format(Number(digits)) : '';
}

/** "2.800.000" → 2800000; vazio → null. */
export function parseMoney(value) {
  const digits = onlyDigits(value);
  return digits ? Number(digits) : null;
}

/** Máscara de CEP: 04772003 → 04772-003 */
export function formatCep(value) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}
