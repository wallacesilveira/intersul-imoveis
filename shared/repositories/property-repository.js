/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/*
 * Contrato público de leitura de imóveis. O site só conversa com este repositório,
 * que hoje lê do Supabase. Outra origem de dados exige apenas um novo adaptador.
 *
 * search(filters)   filters: { purpose: 'sale'|'rent' (omitido = todos), text, type, priceRange, page, pageSize }
 *                   → { items, total, page, pageSize, hasNextPage }
 * getByCode(code)   → imóvel público ou null
 * listFeatured(n)   → imóveis marcados como destaque
 */
import { supabaseAdapter } from './adapters/supabase-adapter.js';

export function createPropertyRepository(adapter) {
  return {
    source: adapter.source,
    search: (filters = {}) => adapter.search(filters),
    getByCode: (code) => adapter.getByCode(code),
    listFeatured: (limit = 9) => adapter.listFeatured(limit),
  };
}

export const propertyRepository = createPropertyRepository(supabaseAdapter);
