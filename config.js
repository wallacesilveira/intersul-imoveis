/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Configuração pública do site. Nada aqui é segredo: a anon key do Supabase é pública por definição. */
export const config = {
  // 'mock' = imóveis fictícios de desenvolvimento. Passa a ser 'supabase' na Etapa 3.
  dataSource: 'mock',
  // Identifica a imobiliária no banco (preparação para múltiplas imobiliárias).
  agencySlug: 'intersul',
  supabase: {
    url: '',
    anonKey: '',
  },
};
