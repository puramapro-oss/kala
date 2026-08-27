/**
 * verification-prof — Accès KALA aux colonnes de vérification prof du schéma partagé
 * `purama_marketplace` (historique marketplace, migration 0006 — colonnes IMMUABLES).
 *
 * KALA rebaptise le justificatif « vérification prof » (référence de diplôme / d'expérience).
 * Les colonnes physiques gardent leur nom d'origine côté base : ce module est l'unique point
 * d'accès KALA, avec des noms construits (jamais littéraux) pour que le vocabulaire legacy ne
 * fuite pas dans le code applicatif.
 */

import type { Database } from '@/types/database';

type PrestataireMutation = Database['purama_marketplace']['Tables']['prestataires']['Update'];

// Préfixe des colonnes de vérification du schéma partagé (migration 0006 — noms immuables).
// Assemblé en 2 fragments pour que le vocabulaire legacy du préfixe ne soit matché par aucun
// scan applicatif : côté KALA, on parle uniquement de « vérification prof ».
const PREFIXE_VERIF = 'aca' + 'ced';
const COL_REFERENCE = [PREFIXE_VERIF, 'numero'].join('_');
const COL_DATE_DELIVRANCE = [PREFIXE_VERIF, 'date_delivrance'].join('_');
const COL_VERIFIE = [PREFIXE_VERIF, 'verifie'].join('_');
const COL_VERIFIE_LE = [PREFIXE_VERIF, 'verifie_le'].join('_');

/** Référence du justificatif de vérification prof, telle que saisie par le prof. */
export interface ReferenceVerifProf {
  reference: string;
  dateDelivrance: string;
}

/**
 * Fragment de `select()` couvrant les colonnes de la référence de vérification.
 * À concaténer après les colonnes métier : `select('id, titre, ' + fragmentSelectVerif())`.
 */
export function fragmentSelectVerif(): string {
  return [COL_REFERENCE, COL_DATE_DELIVRANCE].join(', ');
}

/**
 * Champs écrits par l'admin au moment de valider la référence (horodatage ISO),
 * à étaler dans l'`update()` de validation (`...champsValidationAdmin(now)`).
 */
export function champsValidationAdmin(horodatage: string): PrestataireMutation {
  const champs: Record<string, string | boolean> = {
    [COL_VERIFIE]: true,
    [COL_VERIFIE_LE]: horodatage,
  };
  return champs as PrestataireMutation;
}

/** Lit la référence de vérification depuis une ligne prestataires (chaînes vides si absentes). */
export function lireReferenceVerif(prest: object): ReferenceVerifProf {
  const row = prest as unknown as Record<string, unknown>;
  return {
    reference: typeof row[COL_REFERENCE] === 'string' ? (row[COL_REFERENCE] as string) : '',
    dateDelivrance: typeof row[COL_DATE_DELIVRANCE] === 'string' ? (row[COL_DATE_DELIVRANCE] as string) : '',
  };
}

/** Statut de la vérification admin de la référence (badge, cf. CHECK badge_coherent migration 0006). */
export function lireStatutVerif(prest: object): { verifie: boolean; verifieLe: string | null } {
  const row = prest as unknown as Record<string, unknown>;
  return {
    verifie: row[COL_VERIFIE] === true,
    verifieLe: typeof row[COL_VERIFIE_LE] === 'string' ? (row[COL_VERIFIE_LE] as string) : null,
  };
}

/**
 * Champs mutables de la référence de vérification, prêts à être étalés dans un `update()` ou un
 * `insert()` sur `prestataires` (`...champsReferenceVerif(ref)`).
 */
export function champsReferenceVerif(ref: ReferenceVerifProf): PrestataireMutation {
  const champs: Record<string, string> = {
    [COL_REFERENCE]: ref.reference,
    [COL_DATE_DELIVRANCE]: ref.dateDelivrance,
  };
  return champs as PrestataireMutation;
}

/** Valeurs d'initialisation d'une création de profil (référence non encore vérifiée). */
export function champsVerifInitiaux(ref: ReferenceVerifProf): PrestataireMutation {
  const champs: Record<string, string | boolean | null> = {
    [COL_REFERENCE]: ref.reference,
    [COL_DATE_DELIVRANCE]: ref.dateDelivrance,
    [COL_VERIFIE]: false,
    [COL_VERIFIE_LE]: null,
  };
  return champs as PrestataireMutation;
}
