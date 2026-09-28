/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Imóveis no painel: estoque completo da imobiliária (inclusive não publicados) e vínculos com proprietários. */
import { supabase } from '../../shared/supabase-client.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const forbidden = () => Object.assign(new Error('forbidden'), { code: '42501' });

/** Campos editáveis pelo formulário, na forma como são gravados. */
export const PROPERTY_FIELDS = [
  'code', 'title', 'description', 'type', 'for_sale', 'sale_price', 'for_rent', 'rent_price', 'condo_fee', 'iptu_monthly',
  'neighborhood', 'city', 'state', 'condominium', 'zip_code', 'address', 'address_number', 'address_complement',
  'bedrooms', 'suites', 'bathrooms', 'parking', 'area_m2', 'land_area_m2', 'status', 'published', 'featured', 'responsible_user_id',
];

export const propertiesRepository = {
  async list(agencyId, { text = '', status = '', published = '', responsible = '', archived = false } = {}) {
    let query = supabase
      .from('properties')
      .select('id, code, title, type, for_sale, sale_price, for_rent, rent_price, neighborhood, status, published, featured, responsible_user_id, source, archived_at, updated_at, property_photos (id)')
      .eq('agency_id', agencyId)
      .order('updated_at', { ascending: false })
      .limit(500);
    query = archived ? query.not('archived_at', 'is', null) : query.is('archived_at', null);
    if (status) query = query.eq('status', status);
    if (published) query = query.eq('published', published === 'sim');
    if (responsible) query = query.eq('responsible_user_id', responsible);
    const term = text.replace(/[,()]/g, ' ').trim();
    if (term) query = query.or(`code.ilike.%${term}%,title.ilike.%${term}%,neighborhood.ilike.%${term}%,condominium.ilike.%${term}%`);
    return unwrap(await query);
  },

  async get(id) {
    return unwrap(await supabase
      .from('properties')
      .select('*, property_owners (owner_id, share_percent, owners (id, responsible_user_id, contacts (name, phone))), property_photos (id, storage_path, external_url, position)')
      .eq('id', id)
      .maybeSingle());
  },

  async create(agencyId, row) {
    return unwrap(await supabase.from('properties').insert({ agency_id: agencyId, ...row }).select('id, code').single());
  },

  async update(id, patch) {
    const rows = unwrap(await supabase.from('properties').update(patch).eq('id', id).select('id'));
    if (!rows.length) throw forbidden();
  },

  async remove(id) {
    const rows = unwrap(await supabase.from('properties').delete().eq('id', id).select('id'));
    if (!rows.length) throw forbidden();
  },

  async linkOwner(agencyId, propertyId, ownerId, sharePercent) {
    unwrap(await supabase.from('property_owners').insert({ agency_id: agencyId, property_id: propertyId, owner_id: ownerId, share_percent: sharePercent }).select('owner_id'));
  },

  async unlinkOwner(propertyId, ownerId) {
    const rows = unwrap(await supabase.from('property_owners').delete().eq('property_id', propertyId).eq('owner_id', ownerId).select('owner_id'));
    if (!rows.length) throw forbidden();
  },
};
