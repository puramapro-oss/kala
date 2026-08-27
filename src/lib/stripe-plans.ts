/**
 * stripe-plans.ts — Constantes Stripe SAFE pour le client
 * Aucune clé secrète, aucun import de SDK Stripe.
 * Ce fichier peut être importé côté client sans risque de bundler le SDK.
 */

/**
 * KALA n'a pas d'abonnement SaaS — les paiements sont ponctuels (checkout par cours).
 * Mais on documente ici la structure commune pour cohérence écosystème.
 */
export const PLANS = {
  FREE: {
    id: 'free',
    nom: 'Gratuit',
    prix: 0,
    interval: null,
    description: 'Consulter les profs, réserver un cours',
  },
  // Pas de plan payant en V1 — toute monétisation passe par le paiement du cours
} as const;

/**
 * Devises supportées (Stripe Connect SEPA)
 */
export const CURRENCY = 'eur' as const;

/**
 * Stripe Embedded Components API (Connect onboarding prof)
 */
export const STRIPE_CONNECT_CONFIG = {
  /** Aucun STRIPE_CONNECT_CLIENT_ID requis w/ Embedded Components (D-P10 SPEC) */
  onboardingReturnUrl: '/gains',
  refreshUrl: '/devenir-prof',
} as const;
