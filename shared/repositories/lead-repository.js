/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/*
 * Envio de leads pelo site (função submit_lead do banco).
 *
 * submit({ kind, name, phone, email, message, propertyCode, details, consent, website })
 *   kind: 'property_interest' | 'owner_listing' | 'general'
 *   website: campo-armadilha para robôs; deve chegar vazio
 * Em caso de erro, lança LeadError com uma mensagem pronta para exibir ao visitante.
 */
import { config } from '../../config.js';
import { rpc } from '../supabase-rest.js';

const MESSAGES = {
  invalid_name: 'Informe seu nome.',
  invalid_phone: 'Informe um telefone com DDD.',
  invalid_email: 'Confira o e-mail informado.',
  consent_required: 'Para enviar, é preciso autorizar o contato da Intersul.',
  rate_limited: 'Já recebemos alguns envios deste telefone. Tente mais tarde ou fale pelo WhatsApp.',
};
const FALLBACK = 'Não foi possível enviar agora. Tente novamente ou fale com a Intersul pelo WhatsApp.';

export class LeadError extends Error {}

export const leadRepository = {
  async submit({ kind, name, phone, email, message, propertyCode, details, consent, website }) {
    try {
      await rpc('submit_lead', {
        p_agency_slug: config.agencySlug,
        p_payload: { kind, name, phone, email, message, property_code: propertyCode, details, consent: Boolean(consent), website },
      });
    } catch (error) {
      throw new LeadError(MESSAGES[error.message] || FALLBACK);
    }
  },
};
