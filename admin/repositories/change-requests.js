/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Solicitações de alteração que dependem de aprovação do administrador (funções do banco). */
import { supabase } from '../../shared/supabase-client.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

export const changeRequestsRepository = {
  /** Admin: pendentes da imobiliária. Corretor: as suas (o banco filtra). */
  async list(agencyId, { status = '' } = {}) {
    let query = supabase.from('change_requests').select('*').eq('agency_id', agencyId).order('requested_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    return unwrap(await query);
  },

  async forEntity(entityId) {
    return unwrap(await supabase.from('change_requests').select('*').eq('entity_id', entityId).eq('status', 'pending').order('requested_at'));
  },

  async countPending(agencyId) {
    const { count, error } = await supabase.from('change_requests').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('status', 'pending');
    if (error) throw error;
    return count || 0;
  },

  async request(entity, entityId, action, payload = {}, reason = null) {
    return unwrap(await supabase.rpc('request_change', { p_entity: entity, p_entity_id: entityId, p_action: action, p_payload: payload, p_reason: reason }));
  },

  async review(id, approve, note = null) {
    return unwrap(await supabase.rpc('review_change_request', { p_id: id, p_approve: approve, p_note: note }));
  },

  async cancel(id) {
    unwrap(await supabase.rpc('cancel_change_request', { p_id: id }));
  },
};
