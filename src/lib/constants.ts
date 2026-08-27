/**
 * constants.ts — Source de vérité KALA
 * Aucun chiffre hardcodé ailleurs, toujours importé depuis ici.
 */

// Identité app
export const APP_ID = 'kala' as const;
export const APP_NAME = 'KALA';
export const APP_DOMAIN = 'kala.purama.dev';

// Wallet (règles écosystème)
export const WALLET_MIN = 5; // euros, seuil minimum de retrait KARMA

// Société (mentions légales SASU PURAMA, article 293B CGI — franchise de TVA)
export const COMPANY_INFO = {
  nom: 'PURAMA',
  forme_juridique: 'SASU',
  adresse: '8 Rue Chapelle',
  code_postal: '25560',
  commune: 'Frasne',
  pays: 'France',
  siret: process.env.NEXT_PUBLIC_SIRET || '', // SIRET en cours d'attribution — requis avant lancement public
  tva_non_applicable: true,
  mention_tva: 'TVA non applicable, art. 293 B du CGI',
} as const;

// Admin
export const SUPER_ADMIN_EMAIL = 'matiss.frasne@gmail.com';

// Frais KALA : le prof perçoit 100 % de son tarif, le client paie 9 % de frais de service
export const PCT_FRAIS_SERVICE = 9; // % appliqué au tarif prof pour former les frais de service
export const PCT_COMMISSION_PROF = 0; // le prof garde 100 % de son tarif

// Split KARMA (50 % users / 10 % asso / 40 % SASU) appliqué au REVENU (frais de service net Stripe)
export const KARMA_SPLIT = {
  users: 50,
  asso: 10,
  sasu: 40,
} as const;

// Rate limiting par défaut (requests/min par user)
export const RATE_LIMIT = {
  DEFAULT_RPM: 60,
  MUTATION_RPM: 20,
  AUTH_RPM: 10,
} as const;

// URL helper
export const APP_URL =
  process.env.NEXT_PUBLIC_SITE_URL || `https://${APP_DOMAIN}`;

export const getAbsoluteUrl = (path: string) => `${APP_URL}${path}`;
