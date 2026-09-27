/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Imóveis públicos vindos do Supabase (funções search_properties, get_property e list_featured_properties). */
import { config } from '../../../config.js';
import { PRICE_RANGES, TYPE_FILTERS, toPublicProperty } from '../../property-model.js';
import { rpc, storagePublicUrl } from '../../supabase-rest.js';

const agency = () => config.agencySlug;

function fromDatabase(row) {
  const photos = (row.photos || []).map((photo) => ({ ...photo, url: photo.url || storagePublicUrl(photo.storage_path) }));
  return toPublicProperty({ ...row, photos });
}

/** Converte os filtros do site (rótulos e faixas) no formato aceito pelo banco. */
function toDatabaseFilters({ purpose, text, type, priceRange, page = 1, pageSize = 24 }) {
  const range = PRICE_RANGES[priceRange];
  return {
    purpose: purpose || undefined,
    text: text || undefined,
    types: type ? (TYPE_FILTERS[type] || [type]) : undefined,
    price: range ? { purpose: range.purpose, min: range.min, max: range.max } : undefined,
    page,
    page_size: pageSize,
  };
}

export const supabaseAdapter = {
  source: 'supabase',

  async search(filters = {}) {
    const result = await rpc('search_properties', { p_agency_slug: agency(), p_filters: toDatabaseFilters(filters) });
    return { ...result, items: result.items.map(fromDatabase) };
  },

  async getByCode(code) {
    const row = await rpc('get_property', { p_agency_slug: agency(), p_code: code });
    return row ? fromDatabase(row) : null;
  },

  async listFeatured(limit) {
    const rows = await rpc('list_featured_properties', { p_agency_slug: agency(), p_limit: limit });
    return rows.map(fromDatabase);
  },
};
