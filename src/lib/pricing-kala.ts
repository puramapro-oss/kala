/**
 * pricing-kala.ts — Calcul des frais de service 9% KALA
 * Le prof perçoit 100% de son tarif affiché. Le client paie tarif + frais.
 */

import { PCT_FRAIS_SERVICE } from './constants';

export interface PricingBreakdown {
  /** Tarif affiché par le prof, en centimes */
  tarifCents: number;
  /** Frais de service (9% du tarif), en centimes, arrondi half-up */
  fraisServiceCents: number;
  /** Total à débiter au client, en centimes */
  totalCents: number;
  /** Montant que le prof recevra (100% du tarif), en centimes */
  montantProfCents: number;
}

/**
 * Calcule la répartition tarifaire pour un cours.
 * Le prof garde 100% de son tarif (0% commission).
 * Le client paie tarif + 9% de frais additionnels.
 * Arrondi : au centime le plus proche (half-up).
 */
export function calculerPricing(tarifCentsProf: number): PricingBreakdown {
  if (tarifCentsProf < 0) {
    throw new Error(
      `pricing : tarif négatif interdit (reçu : ${tarifCentsProf})`
    );
  }
  if (!Number.isInteger(tarifCentsProf)) {
    throw new Error(
      `pricing : tarif doit être un entier en centimes (reçu : ${tarifCentsProf})`
    );
  }

  // Frais de service = 9% du tarif, arrondi au centime
  const fraisServiceCents = Math.round((tarifCentsProf * PCT_FRAIS_SERVICE) / 100);

  // Total = tarif + frais
  const totalCents = tarifCentsProf + fraisServiceCents;

  // Le prof reçoit 100% du tarif (zéro commission)
  const montantProfCents = tarifCentsProf;

  return {
    tarifCents: tarifCentsProf,
    fraisServiceCents,
    totalCents,
    montantProfCents,
  };
}
