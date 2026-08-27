import type { LegalAppConfig } from './types';
import { buildCompanyInfo, buildMediateurInfo } from './company';
import { APP_ID, APP_NAME, APP_DOMAIN } from '@/lib/constants';

/**
 * Config NIYAMA de KALA. `aPaiement=true` (Stripe checkout réel, `src/app/api/stripe/checkout`)
 * `aChatIA=false` (aucun assistant IA conversationnel dans l'app — grep vérifié, aucun
 * `askClaude`/`ChatInterface`/route `/api/ai` réel, seulement des libs génériques inutilisées).
 */
export const KALA_LEGAL_CONFIG: LegalAppConfig = {
  slug: APP_ID,
  nom: APP_NAME,
  domaine: APP_DOMAIN,
  famille: 'marketplace_sap',
  company: buildCompanyInfo(),
  mediateur: buildMediateurInfo(),
  descriptionActivite:
    'KALA met en relation des élèves (ou leurs parents) et des profs vérifiés pour des cours de musique et de loisirs, à domicile ou chez le prof.',
  aPaiement: true,
  aChatIA: false,
};
