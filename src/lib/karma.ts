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

  const totalCents = Math.round(revenuNetEuros * 100);
  if (!Number.isSafeInteger(totalCents * Math.max(KARMA_SPLIT.users, KARMA_SPLIT.asso))) {
    throw new Error('karma.splitRevenue : montant non représentable en centimes');
  }

  const usersCents = Math.round((totalCents * KARMA_SPLIT.users) / 100);
  const assoCents = Math.round((totalCents * KARMA_SPLIT.asso) / 100);
  // Le reliquat absorbe les arrondis : aucun centime créé ni perdu.
  const sasuCents = totalCents - usersCents - assoCents;

  return {
    montantTotal: totalCents / 100,
    partUsers: usersCents / 100,
    partAsso: assoCents / 100,
    partSASU: sasuCents / 100,
  };
}
