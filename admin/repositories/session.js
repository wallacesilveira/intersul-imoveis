/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Login, sessão e vínculo do usuário com a imobiliária. */
import { supabase } from '../../shared/supabase-client.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

export const sessionRepository = {
  async currentUser() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user || null;
  },

  async signIn(email, password) {
    return unwrap(await supabase.auth.signInWithPassword({ email, password })).user;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async requestPasswordReset(email) {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    unwrap(await supabase.auth.resetPasswordForEmail(email, { redirectTo }));
  },

  async updatePassword(password) {
    unwrap(await supabase.auth.updateUser({ password }));
  },

  onPasswordRecovery(callback) {
    supabase.auth.onAuthStateChange((event) => {
      // o callback do Supabase não deve aguardar outras chamadas dele; por isso o setTimeout
      if (event === 'PASSWORD_RECOVERY') setTimeout(callback, 0);
    });
  },

  /** Vínculos ativos do usuário. Na V1 o painel usa o primeiro. */
  async memberships(userId) {
    return unwrap(await supabase
      .from('agency_members')
      .select('agency_id, user_id, role, full_name, agencies (id, slug, name, settings)')
      .eq('user_id', userId)
      .eq('active', true));
  },

  async team(agencyId) {
    return unwrap(await supabase
      .from('agency_members')
      .select('user_id, full_name, role, active')
      .eq('agency_id', agencyId)
      .order('full_name'));
  },
};
