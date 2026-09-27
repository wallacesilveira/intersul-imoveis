/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Modelo de imóvel: vocabulário controlado e conversão do formato do banco para o formato usado pelas telas. */
import { formatArea, formatCurrency } from './format.js';

/** Tipos aceitos. O código é o valor gravado no banco; o rótulo é o que aparece no site. */
export const PROPERTY_TYPES = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  sobrado: 'Sobrado',
  casa_condominio: 'Casa em condomínio',
  cobertura: 'Cobertura',
  terreno: 'Terreno',
  sala_comercial: 'Sala comercial',
  loja: 'Loja',
  galpao: 'Galpão',
};

/** Opções do filtro de tipo do site → tipos que cada opção abrange. */
export const TYPE_FILTERS = {
  Casa: ['casa', 'sobrado', 'casa_condominio'],
  Apartamento: ['apartamento', 'cobertura'],
  Terreno: ['terreno'],
  Sala: ['sala_comercial'],
  Loja: ['loja'],
};

/**
 * Faixas do filtro de preço. Cada faixa pertence a uma finalidade: faixas de venda
 * comparam o preço de venda; faixas de locação, o aluguel mensal.
 */
export const PRICE_RANGES = {
  'ate-500mil': { purpose: 'sale', label: 'Até R$ 500 mil', max: 500000 },
  '500mil-1mi': { purpose: 'sale', label: 'R$ 500 mil a R$ 1 mi', min: 500000, max: 1000000 },
  'acima-1mi': { purpose: 'sale', label: 'Acima de R$ 1 mi', min: 1000000 },
  'aluguel-ate-3mil': { purpose: 'rent', label: 'Até R$ 3 mil / mês', max: 3000 },
  'aluguel-3mil-5mil': { purpose: 'rent', label: 'R$ 3 mil a R$ 5 mil / mês', min: 3000, max: 5000 },
  'aluguel-5mil-10mil': { purpose: 'rent', label: 'R$ 5 mil a R$ 10 mil / mês', min: 5000, max: 10000 },
  'aluguel-acima-10mil': { purpose: 'rent', label: 'Acima de R$ 10 mil / mês', min: 10000 },
};

/** Faixas de uma finalidade, como pares [valor, rótulo] para montar <option>. */
export function priceRangeOptions(purpose) {
  return Object.entries(PRICE_RANGES).filter(([, range]) => range.purpose === purpose).map(([value, range]) => [value, range.label]);
}

/** Situação comercial. Só `available` e `reserved` aparecem no site (regra aplicada pelo banco). */
export const PROPERTY_STATUS = {
  available: 'Disponível',
  reserved: 'Reservado',
  sold: 'Vendido',
  rented: 'Alugado',
  inactive: 'Inativo',
};

/** Converte uma linha do banco (snake_case) no objeto público usado pelo site. */
export function toPublicProperty(row) {
  const photos = [...(row.photos || [])].sort((a, b) => a.position - b.position).map((photo) => photo.url);
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description || '',
    type: row.type,
    typeLabel: PROPERTY_TYPES[row.type] || row.type,
    neighborhood: row.neighborhood,
    city: row.city,
    condominium: row.condominium || '',
    forSale: Boolean(row.for_sale),
    salePrice: row.sale_price ?? null,
    forRent: Boolean(row.for_rent),
    rentPrice: row.rent_price ?? null,
    condoFee: row.condo_fee ?? null,
    iptuMonthly: row.iptu_monthly ?? null,
    bedrooms: row.bedrooms ?? null,
    suites: row.suites ?? null,
    bathrooms: row.bathrooms ?? null,
    parking: row.parking ?? null,
    area: row.area_m2 ?? null,
    landArea: row.land_area_m2 ?? null,
    status: row.status,
    featured: Boolean(row.featured),
    coverUrl: photos[0] || '',
    photos,
  };
}

/** Preço exibido conforme o contexto: 'sale' | 'rent' | 'featured' (venda, se houver; senão locação). */
export function priceLabel(property, context = 'featured') {
  const showRent = context === 'rent' || (context !== 'sale' && !property.forSale);
  if (showRent) return property.rentPrice === null ? 'Locação sob consulta' : `${formatCurrency(property.rentPrice)} / mês`;
  return property.salePrice === null ? 'Venda sob consulta' : formatCurrency(property.salePrice);
}

/** Área exibida: a construída/útil; para terrenos (sem área construída), a do terreno. */
export function areaLabel(property) {
  return formatArea(property.area ?? property.landArea);
}
