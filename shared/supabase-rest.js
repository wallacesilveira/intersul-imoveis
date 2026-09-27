/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Acesso público ao Supabase: chamadas às funções do banco (RPC) com a chave publicável. */
import { config } from '../config.js';

export class SupabaseRpcError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'SupabaseRpcError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Chama uma função pública do banco. Erros de negócio chegam com a mensagem definida no SQL (ex.: 'consent_required'). */
export async function rpc(name, args = {}) {
  const response = await fetch(`${config.supabase.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: config.supabase.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new SupabaseRpcError(body?.message || `Erro ${response.status}`, { status: response.status, code: body?.code, details: body?.details });
  return body;
}

/** URL pública de um arquivo do bucket de fotos. */
export function storagePublicUrl(path) {
  return `${config.supabase.url}/storage/v1/object/public/property-photos/${path.split('/').map(encodeURIComponent).join('/')}`;
}
