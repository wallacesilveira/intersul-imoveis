/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Leads: o admin vê todos e distribui; o corretor vê os atribuídos a ele (regra do banco). */
import { onlyDigits } from '../../shared/format.js';
import { supabase } from '../../shared/supabase-client.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };
const forbidden = () => Object.assign(new Error('forbidden'), { code: '42501' });

export const leadsRepository = {
  async list(agencyId, { status = '', kind = '', assigned = '', text = '' } = {}) {
    const term = text.replace(/[,()]/g, ' ').trim();
    let query = supabase
      .from('leads')
      .select(`id, kind, status, origin, message, created_at, updated_at, assigned_to, contacts${term ? '!inner' : ''} (id, name, phone, email), properties (id, code, title)`)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(300);
    if (status) query = query.eq('status', status);
    if (kind) query = query.eq('kind', kind);
    if (assigned === 'none') query = query.is('assigned_to', null);
    else if (assigned) query = query.eq('assigned_to', assigned);
    if (term) {
      const digits = onlyDigits(term);
      const filters = [`name.ilike.%${term}%`, `email.ilike.%${term}%`];
      if (digits.length >= 3) filters.push(`phone.ilike.%${digits}%`);
      query = query.or(filters.join(','), { referencedTable: 'contacts' });
    }
    return unwrap(await query);
  },

  async get(id) {
    return unwrap(await supabase
      .from('leads')
      .select('*, contacts (*), properties (id, code, title, status, published), lead_activities (id, type, body, data, user_id, created_at)')
      .eq('id', id)
      .order('created_at', { referencedTable: 'lead_activities', ascending: false })
      .maybeSingle());
  },

  async countNew(agencyId) {
    const { count, error } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'new');
    if (error) throw error;
    return count || 0;
  },

  async create(agencyId, row) {
    return unwrap(await supabase.from('leads').insert({ agency_id: agencyId, origin: 'manual', ...row }).select('id').single());
  },

  async update(id, patch) {
    const rows = unwrap(await supabase.from('leads').update(patch).eq('id', id).select('id'));
    if (!rows.length) throw forbidden();
  },

  async addNote(agencyId, leadId, body) {
    unwrap(await supabase.from('lead_activities').insert({ agency_id: agencyId, lead_id: leadId, type: 'note', body }).select('id'));
  },

  async remove(id) {
    const rows = unwrap(await supabase.from('leads').delete().eq('id', id).select('id'));
    if (!rows.length) throw forbidden();
  },
};
