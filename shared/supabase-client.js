/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Cliente completo do Supabase (login, tabelas, arquivos), usado pelo painel. O site público usa supabase-rest.js. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import { config } from '../config.js';

export const supabase = createClient(config.supabase.url, config.supabase.publishableKey, {
  // implicit: links de e-mail voltam com o tipo (recovery/invite) na URL, o que o painel usa para abrir "Nova senha"
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
});
