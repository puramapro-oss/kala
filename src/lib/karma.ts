/**
 * karma.ts — Split KARMA 50/10/40 appliqué au revenu net de frais de service
 * Aucun calcul ne touche au tarif du prof (0 % commission).
 */

import { KARMA_SPLIT } from './constants';

export interface KarmaSplitResult {
  /**
   * Montant total à splitter (en euros), correspond au revenu de frais de service
   * net des frais Stripe — jamais le tarif du prof (qui reste à 100 %).
   */
  montantTotal: number;
  /**
   * Part users (50 %) — alimente le wallet du client du cours.
   */
  partUsers: number;
  /**
   * Part asso (10 %) — alimente la fondation PURAMA (à venir).
   */
  partAsso: number;
  /**
   * Part SASU (40 %) — revenu de la plateforme.
   */
  partSASU: number;
}

/**
 * Répartit un revenu net selon le split 50/10/40.
 * Le montant d'entrée est le revenu de frais de service déjà net de tout frais Stripe.
 * Exemple : cours 100€ → frais 9€ → Stripe prend ~0,35€ → revenu net 8,65€ → split 50/10/40 appliqué sur 8,65€.
 */
export function splitRevenue(revenuNetEuros: number): KarmaSplitResult {
  if (revenuNetEuros < 0) {
    throw new Error(
      `karma.splitRevenue : revenu négatif interdit (reçu : ${revenuNetEuros})`
    );
  }

  // Arrondi au centime le plus proche (half-up) pour chaque part.
  // BUG CORRIGÉ : l'ancienne formule `/100*100` avant le round() était une
  // opération neutre qui arrondissait en réalité à l'EURO le plus proche
  // (perte de 2 décimales) avant de re-diviser par 100 — ex: 8.65€*50%=4.325€
  // devenait round(4.325)/100=0.04€ au lieu de 4.33€ (~108× sous-crédité).
  const partUsers = Math.round(revenuNetEuros * KARMA_SPLIT.users * 100) / 100;
  const partAsso = Math.round(revenuNetEuros * KARMA_SPLIT.asso * 100) / 100;
  // partSASU = reliquat pour garantir partUsers+partAsso+partSASU === revenuNetEuros exactement
  const partSASU = Math.round((revenuNetEuros - partUsers - partAsso) * 100) / 100;

  return {
    montantTotal: revenuNetEuros,
    partUsers,
    partAsso,
    partSASU,
  };
}
