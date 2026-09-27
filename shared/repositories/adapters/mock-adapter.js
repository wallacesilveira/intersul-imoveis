/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/*
 * Adaptador TEMPORÁRIO com os imóveis fictícios usados para desenvolver o layout.
 * Nenhum destes dados é da Intersul. Na Etapa 3 este arquivo é removido e os mesmos
 * registros passam a existir apenas como seed do banco (source = 'demo').
 *
 * As linhas imitam o formato que o banco devolverá (snake_case), para que a conversão
 * `toPublicProperty` seja a mesma nos dois adaptadores.
 */
import { normalizeText } from '../../format.js';
import { PRICE_RANGES, TYPE_FILTERS, isPubliclyVisible, toPublicProperty } from '../../property-model.js';

const PLACEHOLDER_DESCRIPTION = '[DESCRIÇÃO COMPLETA DO IMÓVEL A CONFIRMAR]';
const unsplash = (photoId) => `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=1200&q=80`;

const demo = (row) => ({
  source: 'demo', city: 'São Paulo', description: PLACEHOLDER_DESCRIPTION,
  for_sale: false, sale_price: null, for_rent: false, rent_price: null,
  bedrooms: null, suites: null, parking: null, area_m2: null, land_area_m2: null,
  status: 'available', published: true, featured: true, archived_at: null,
  ...row,
  photos: row.photos.map((url, position) => ({ url, position })),
});

const demoRows = [
  demo({ id: 'demo-01', code: 'DEMO-01', title: 'Casa contemporânea junto ao verde de Interlagos', type: 'casa', for_sale: true, sale_price: 2800000, neighborhood: 'Interlagos', bedrooms: 4, suites: 2, parking: 4, area_m2: 471, photos: [unsplash('photo-1600607687920-4e2a09cf159d')] }),
  demo({ id: 'demo-02', code: 'DEMO-02', title: 'Casa térrea com jardim em Veleiros', type: 'casa', for_sale: true, sale_price: 1200000, neighborhood: 'Veleiros', bedrooms: 3, suites: 1, parking: 3, area_m2: 125, photos: [unsplash('photo-1600585154340-be6161a56a0c')] }),
  demo({ id: 'demo-03', code: 'DEMO-03', title: 'Apartamento iluminado no eixo de Santo Amaro', type: 'apartamento', for_rent: true, rent_price: 4200, neighborhood: 'Santo Amaro', bedrooms: 2, suites: 1, parking: 2, area_m2: 92, photos: [unsplash('photo-1600607688969-a5bfcd646154')] }),
  demo({ id: 'demo-04', code: 'DEMO-04', title: 'Terreno para projeto em Interlagos', type: 'terreno', for_sale: true, sale_price: 8500000, neighborhood: 'Interlagos', land_area_m2: 2072, photos: [unsplash('photo-1500382017468-9049fed747ef')] }),
  demo({ id: 'demo-05', code: 'DEMO-05', title: 'Sobrado contemporâneo no Bolsão', type: 'sobrado', for_sale: true, sale_price: 2450000, neighborhood: 'Bolsão de Interlagos', bedrooms: 3, suites: 2, parking: 3, area_m2: 310, photos: [unsplash('photo-1600566753086-00f18fb6b3ea')] }),
  demo({ id: 'demo-06', code: 'DEMO-06', title: 'Apartamento com varanda em Marajoara', type: 'apartamento', for_rent: true, rent_price: 3800, neighborhood: 'Marajoara', bedrooms: 2, suites: 1, parking: 1, area_m2: 88, photos: [unsplash('photo-1600607687920-4e2a09cf159d')] }),
  demo({ id: 'demo-07', code: 'DEMO-07', title: 'Sala comercial próxima a Santo Amaro', type: 'sala_comercial', for_rent: true, rent_price: 2900, neighborhood: 'Santo Amaro', parking: 2, area_m2: 64, photos: [unsplash('photo-1497366754035-f200968a6e72')] }),
  demo({ id: 'demo-08', code: 'DEMO-08', title: 'Casa com quintal no Jardim Suzana', type: 'casa', for_sale: true, sale_price: 1780000, neighborhood: 'Jardim Suzana', bedrooms: 3, suites: 1, parking: 3, area_m2: 210, photos: [unsplash('photo-1600047509807-ba8f99d2cdde')] }),
  demo({ id: 'demo-09', code: 'DEMO-09', title: 'Loja para locação em Socorro', type: 'loja', for_rent: true, rent_price: 7000, neighborhood: 'Socorro', parking: 4, area_m2: 140, photos: [unsplash('photo-1497366811353-6870744d04b2')] }),
];

const visibleRows = () => demoRows.filter(isPubliclyVisible);

function matchesFilters(row, { purpose, text, type, priceRange }) {
  if (purpose === 'sale' && !row.for_sale) return false;
  if (purpose === 'rent' && !row.for_rent) return false;
  if (type && !(TYPE_FILTERS[type] || [type]).includes(row.type)) return false;
  if (text) {
    const haystack = normalizeText([row.code, row.title, row.condominium, row.neighborhood, row.city].filter(Boolean).join(' '));
    if (!haystack.includes(normalizeText(text))) return false;
  }
  const range = PRICE_RANGES[priceRange];
  if (range) {
    const offered = range.purpose === 'rent' ? row.for_rent : row.for_sale;
    const price = range.purpose === 'rent' ? row.rent_price : row.sale_price;
    if (!offered || price === null) return false;
    if (range.min !== undefined && price < range.min) return false;
    if (range.max !== undefined && price > range.max) return false;
  }
  return true;
}

export const mockAdapter = {
  source: 'mock-demo',

  async search(filters = {}) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 24;
    const matches = visibleRows().filter((row) => matchesFilters(row, filters));
    const items = matches.slice((page - 1) * pageSize, page * pageSize).map(toPublicProperty);
    return { items, total: matches.length, page, pageSize, hasNextPage: page * pageSize < matches.length };
  },

  async getByCode(code) {
    const wanted = normalizeText(code);
    const row = visibleRows().find((item) => normalizeText(item.code) === wanted);
    return row ? toPublicProperty(row) : null;
  },

  async listFeatured(limit) {
    return visibleRows().filter((row) => row.featured).slice(0, limit).map(toPublicProperty);
  },
};
