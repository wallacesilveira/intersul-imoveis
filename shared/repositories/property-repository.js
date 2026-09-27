/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/*
 * Contrato público de leitura de imóveis. O site só conversa com este repositório;
 * a origem dos dados (mock agora, Supabase a partir da Etapa 3) é escolhida no config.js.
 *
 * search(filters)   filters: { purpose: 'sale'|'rent' (omitido = todos), text, type, priceRange, page, pageSize }
 *                   → { items, total, page, pageSize, hasNextPage }
 * getByCode(code)   → imóvel público ou null
 * listFeatured(n)   → imóveis marcados como destaque
 */
import { config } from '../../config.js';
import { mockAdapter } from './adapters/mock-adapter.js';

const adapters = { mock: mockAdapter };

export function createPropertyRepository(adapter) {
  return {
    source: adapter.source,
    search: (filters = {}) => adapter.search(filters),
    getByCode: (code) => adapter.getByCode(code),
    listFeatured: (limit = 9) => adapter.listFeatured(limit),
  };
}

const adapter = adapters[config.dataSource];
if (!adapter) throw new Error(`Fonte de dados desconhecida em config.js: "${config.dataSource}"`);

export const propertyRepository = createPropertyRepository(adapter);
