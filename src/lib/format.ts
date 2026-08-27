/**
 * format.ts — Formatage cohérent des prix, distances, dates (DESIGN-PLAN §2, DESIGN-SCORE rubrique 2).
 * Français canonique, toujours en font-mono (Anonymous Pro, tabular-nums).
 */

/**
 * Formate un montant en centimes → prix français avec virgule + espace normal (pas insécable).
 * Ex: 1800 → "18,00 €"
 */
export function formatPrix(centimes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(centimes / 100).replace(/ | /g, ' ');
}

/**
 * Formate une distance en km avec 1 décimale — UNE seule unité pour toutes les distances connues
 * (B30-15, passage 30 : « 4,8 · À proximité » côtoyait « 4,7 · 3,2 km » sur la même ligne du même
 * composant — deux formats pour la même donnée). Sous 150 m, on arrondit honnêtement à « 0,1 km »
 * plutôt que d'inventer un libellé : « À proximité » n'est plus utilisé QUE quand la distance est
 * inconnue (repli assumé par l'appelant, pas par ce formateur).
 */
export function formatDistance(km: number): string {
  const arrondi = Math.max(km, 0.1);
  return `${arrondi.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

/**
 * Formate une date courte française.
 * Ex: new Date('2026-08-07') → "07/08/2026"
 */
export function formatDateCourte(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR').format(date);
}

/**
 * Formate un pourcentage français — UNE seule règle pour le signe % dans tout le produit
 * (B31-8, passage 31 : trois traitements coexistaient — « 0% » sans espace via un faux espace
 * `ml-[3px]`, « 100 % » avec espace ordinaire U+0020, « 100 % » avec fine insécable U+202F sur
 * les pages légales). Règle typographique française : fine insécable U+202F avant %, partout.
 * Le point de code mesurable avant % doit être 8239 sur les 16 pages.
 * Ex: 0 → "0 %", 9 → "9 %", 100 → "100 %"
 */
export function formatPourcent(n: number): string {
  return `${n.toLocaleString('fr-FR')} %`;
}

/**
 * Formate une plage de dates — DEUX variantes assumées pour tout le produit (B34-6, passage 34) :
 * un même cours était daté de 3 façons en 2 familles typographiques sur 3 écrans consécutifs
 * (« Du 12/08/2026 au 14/08/2026 » en chiffres mono, « Du 12 août 2026 · Au 14 août 2026 » en
 * lettres Inter, « 12 août → 14 août » en lettres sans année). Au plus 2 formats dans tout KALA :
 * `formatPlageLongue` pour les titres/sous-titres (Inter), `formatPlageCompacte` pour les cartes et
 * listes (mono). Accepte `Date` ou une string ISO (colonnes `debut_le`/`fin_le` réelles).
 */
function versDate(valeur: Date | string): Date {
  return typeof valeur === 'string' ? new Date(valeur) : valeur;
}

/**
 * Plage longue, pour titres/sous-titres. Ex: « Du 12 août 2026 au 14 août 2026 ».
 */
export function formatPlageLongue(debut: Date | string, fin: Date | string): string {
  const d1 = versDate(debut);
  const d2 = versDate(fin);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  return `Du ${d1.toLocaleDateString('fr-FR', opts)} au ${d2.toLocaleDateString('fr-FR', opts)}`;
}

/**
 * Plage compacte, pour cartes/listes (toujours en font-mono côté appelant). Garde le séparateur
 * flèche déjà utilisé. Ex: « 12 → 14 août 2026 » (même mois) ou « 28 juillet → 2 août 2026»
 * (mois différents).
 */
export function formatPlageCompacte(debut: Date | string, fin: Date | string): string {
  const d1 = versDate(debut);
  const d2 = versDate(fin);
  const memeMoisEtAnnee = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  const debutTexte = memeMoisEtAnnee
    ? d1.toLocaleDateString('fr-FR', { day: 'numeric' })
    : d1.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const finTexte = d2.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${debutTexte} → ${finTexte}`;
}
