/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Contatos (pessoas). O que cada usuário enxerga é decidido pelo banco (RLS). */
import { onlyDigits } from '../../shared/format.js';
import { supabase } from '../../shared/supabase-client.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const FIELDS = ['name', 'phone', 'whatsapp', 'email', 'document', 'notes'];

function clean(input) {
  const row = {};
  for (const field of FIELDS) row[field] = (input[field] ?? '').toString().trim() || null;
  return row;
}

export const contactsRepository = {
  async list(agencyId, search = '') {
    let query = supabase
      .from('contacts')
      .select('id, name, phone, email, created_at, owners (id), leads (id)')
      .eq('agency_id', agencyId)
      .order('name')
      .limit(300);
    // vírgulas e parênteses têm significado no filtro "or"; são removidos da busca
    const term = search.replace(/[,()]/g, ' ').trim();
    if (term) {
      const digits = onlyDigits(term);
      const filters = [`name.ilike.%${term}%`, `email.ilike.%${term}%`];
      if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`, `whatsapp.ilike.%${digits}%`);
      query = query.or(filters.join(','));
    }
    return unwrap(await query);
  },

  async get(id) {
    return unwrap(await supabase.from('contacts').select('*').eq('id', id).maybeSingle());
  },

  async create(agencyId, input) {
    return unwrap(await supabase.from('contacts').insert({ agency_id: agencyId, ...clean(input) }).select('id').single());
  },

  async update(id, input) {
    const rows = unwrap(await supabase.from('contacts').update(clean(input)).eq('id', id).select('id'));
    if (!rows.length) throw Object.assign(new Error('forbidden'), { code: '42501' });
  },

  async remove(id) {
    const rows = unwrap(await supabase.from('contacts').delete().eq('id', id).select('id'));
    if (!rows.length) throw Object.assign(new Error('forbidden'), { code: '42501' });
  },

  async leads(contactId) {
    return unwrap(await supabase
      .from('leads')
      .select('id, kind, status, message, created_at, assigned_to, properties (code, title)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false }));
  },
};
