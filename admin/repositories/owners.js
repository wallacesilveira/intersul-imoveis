/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Proprietários: papel de um contato, com corretor responsável. Corretores só veem os seus (RLS). */
import { supabase } from '../../shared/supabase-client.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

export const ownersRepository = {
  async list(agencyId, responsibleUserId = '') {
    let query = supabase
      .from('owners')
      .select('id, status, responsible_user_id, created_at, contacts (id, name, phone, email), property_owners (property_id)')
      .eq('agency_id', agencyId);
    if (responsibleUserId) query = query.eq('responsible_user_id', responsibleUserId);
    const rows = unwrap(await query);
    return rows.sort((a, b) => a.contacts.name.localeCompare(b.contacts.name, 'pt-BR'));
  },

  async get(id) {
    return unwrap(await supabase
      .from('owners')
      .select('*, contacts (*), property_owners (share_percent, properties (id, code, title, status, published))')
      .eq('id', id)
      .maybeSingle());
  },

  async findByContact(contactId) {
    return unwrap(await supabase.from('owners').select('id, status, responsible_user_id').eq('contact_id', contactId).maybeSingle());
  },

  async create(agencyId, contactId, responsibleUserId) {
    return unwrap(await supabase
      .from('owners')
      .insert({ agency_id: agencyId, contact_id: contactId, responsible_user_id: responsibleUserId })
      .select('id')
      .single());
  },

  async update(id, patch) {
    const rows = unwrap(await supabase.from('owners').update(patch).eq('id', id).select('id'));
    if (!rows.length) throw Object.assign(new Error('forbidden'), { code: '42501' });
  },

  async remove(id) {
    const rows = unwrap(await supabase.from('owners').delete().eq('id', id).select('id'));
    if (!rows.length) throw Object.assign(new Error('forbidden'), { code: '42501' });
  },
};
