/**
 * FormulaireReservation — Brique 3 EX-028/029/030/031/032
 * Sélection type de cours, dates, détails cours (instrument, niveau, domicile de l'élève),
 * récap pricing affiché (calculé client READONLY).
 * Le montant réel sera recalculé serveur (EX-034).
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useReservation } from '@/hooks/useReservation';
import { calculerPricing } from '@/lib/pricing-kala';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CardTitle from '@/components/ui/CardTitle';
import FormeOndeConfirmation from '@/components/ui/FormeOndeConfirmation';
import type { Database } from '@/types/database';

type TypeGarde = Database['purama_marketplace']['Enums']['type_garde'];

// B30-5 : formatage prix unifié FR (jamais `toFixed(2)` — pas d'espace insécable entre le
// nombre et le symbole, format non localisé).
const formatEuros = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

// B41-2 (passage 41, MAJEUR) : `<input type="datetime-local">` natif affichait `mm/dd/yyyy,
// --:-- --` (format US, horloge 12h) MÊME en contexte `locale: 'fr-FR'` (le DA a vérifié : le
// chrome du champ dépend de la langue du NAVIGATEUR/OS, jamais de `lang="fr"` sur la page — rien
// côté code ne peut le forcer). Seul un champ texte intégralement maîtrisé (masque manuel, jamais
// le widget natif du navigateur) garantit `jj/mm/aaaa` quel que soit l'environnement de rendu.
const maskDate = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const maskTime = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
};

// Combine jj/mm/aaaa + hh:mm en `YYYY-MM-DDTHH:mm` (même format qu'un `datetime-local`, attendu
// en ISO8601 par `useReservation` — cf. `hooks/useReservation.ts`). Retourne `null` si incomplet
// ou invalide (validé côté appelant avant soumission).
const combineDateHeure = (dateStr: string, heureStr: string): string | null => {
  const m = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const h = heureStr.match(/^(\d{2}):(\d{2})$/);
  if (!m || !h) return null;
  const [, jj, mm, aaaa] = m;
  const [, hh, min] = h;
  const jour = Number(jj);
  const mois = Number(mm);
  const heure = Number(hh);
  const minute = Number(min);
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31 || heure > 23 || minute > 59) return null;
  const iso = `${aaaa}-${mm}-${jj}T${hh}:${min}`;
  // Rejette une date calendaire invalide (31/02, etc.) : Date normalise silencieusement sinon.
  const check = new Date(iso);
  if (Number.isNaN(check.getTime()) || check.getDate() !== jour || check.getMonth() + 1 !== mois) {
    return null;
  }
  return iso;
};

const NIVEAUX = ['Débutant', 'Intermédiaire', 'Avancé'] as const;

interface Props {
  prestataireId: string;
  tarifDomicileCents: number;
  tarifVisiteCents: number;
  onSuccess?: (reservationId: string) => void;
}

export default function FormulaireReservation({
  prestataireId,
  tarifDomicileCents,
  tarifVisiteCents,
  onSuccess,
}: Props) {
  const { loading, error, createReservation } = useReservation();
  // Redirection par défaut ICI, côté client (B29, passage 29) : la page serveur passait une
  // FONCTION `onSuccess` en prop — interdit à la frontière Server→Client Component, l'écran
  // entier crashait (« Event handlers cannot be passed to Client Component props »), jamais vu
  // avant car la route était inatteignable (B29-1). `onSuccess` reste supporté pour un parent
  // client, mais n'est plus requis.
  const router = useRouter();

  const [typeGarde, setTypeGarde] = useState<TypeGarde>('domicile');
  // B41-2 : jj/mm/aaaa + hh:mm maîtrisés (jamais un widget natif) — combinés en ISO8601 juste
  // avant soumission (`combineDateHeure`).
  const [debutDateStr, setDebutDateStr] = useState('');
  const [debutHeureStr, setDebutHeureStr] = useState('');
  const [finDateStr, setFinDateStr] = useState('');
  const [finHeureStr, setFinHeureStr] = useState('');
  // Détails du cours (KALA : instrument, niveau, adresse de l'élève pour un cours à domicile)
  const [instrument, setInstrument] = useState('');
  const [niveau, setNiveau] = useState<(typeof NIVEAUX)[number]>('Débutant');
  const [adresseEleve, setAdresseEleve] = useState('');
  // Erreurs de validation dans le même bloc stylé que les erreurs API — jamais un `alert()`
  // navigateur (non traduit/stylé, même classe de défaut que B28-7).
  const [formError, setFormError] = useState<string | null>(null);

  const [tarifCents, setTarifCents] = useState(tarifDomicileCents);
  const [pricingBreakdown, setPricingBreakdown] = useState(calculerPricing(tarifDomicileCents));
  const [formeOndeTriggered, setFormeOndeTriggered] = useState(false);
  const [formeOndePos, setFormeOndePos] = useState({ x: 0, y: 0 });

  // Mise à jour tarif selon type (EX-028) — KALA : domicile ou chez le prof uniquement
  useEffect(() => {
    const newTarif = typeGarde === 'visite' ? tarifVisiteCents : tarifDomicileCents;

    setTarifCents(newTarif);
    setPricingBreakdown(calculerPricing(newTarif));
  }, [typeGarde, tarifDomicileCents, tarifVisiteCents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const debutLe = combineDateHeure(debutDateStr, debutHeureStr);
    const finLe = combineDateHeure(finDateStr, finHeureStr);
    if (!debutLe || !finLe) {
      setFormError('Veuillez renseigner une date (jj/mm/aaaa) et une heure (hh:mm) valides pour le début et la fin.');
      return;
    }
    if (!instrument.trim()) {
      setFormError('Veuillez renseigner l\'instrument ou l\'activité du cours.');
      return;
    }
    if (typeGarde === 'domicile' && !adresseEleve.trim()) {
      setFormError('Veuillez renseigner l\'adresse du domicile pour un cours à domicile.');
      return;
    }

    // Capturer la position du clic (depuis le bouton submit)
    const target = e.target as HTMLFormElement;
    const submitButton = target.querySelector('button[type="submit"]');
    if (submitButton) {
      const rect = submitButton.getBoundingClientRect();
      setFormeOndePos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }

    const res = await createReservation({
      prestataireId,
      typeGarde,
      debutLe,
      finLe,
      tarifCents,
    });

    if (res) {
      // Déclencher la forme d'onde de confirmation (DESIGN-PLAN §3)
      setFormeOndeTriggered(true);

      // Attendre fin animation avant redirect
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(res.id);
        } else {
          router.push(`/dashboard?confirmation=reservation&id=${res.id}`);
        }
      }, 1300);
    }
  };

  return (
    <>
      <FormeOndeConfirmation
        trigger={formeOndeTriggered}
        x={formeOndePos.x}
        y={formeOndePos.y}
        onComplete={() => setFormeOndeTriggered(false)}
      />
      {/* B31-6 : deux colonnes à partir de xl — formulaire à gauche (B30-4 : pas de mx-auto, ancrée
          sur le rail commun), récapitulatif + rétractation en colonne collante à droite (360 px,
          même largeur que les sidebars de /timeline et /devenir-prof — un seul gabarit de colonne
          latérale dans tout le produit). Sous xl, empilement inchangé : la carte de récap suit
          simplement la carte du formulaire.
          B35-2 (passage 35, MAJEUR) : `minmax(0,32rem),360px` = 512+32+360 = 904 px dans un
          conteneur de 1232 — bord droit à 1008 contre le rail commun 1336 (header/footer), 2 bords
          droits visibles sur le même écran. `minmax(0,1fr)_360px` laisse la colonne formulaire
          absorber le reliquat côté PISTE.
          B36-2/B35-2 (passage 36, MAJEUR) : `max-w-lg` (512px) sur la carte elle-même rouvrait le
          même canyon À L'INTÉRIEUR de la piste déjà corrigée (512 sur une piste de 840, 328px de
          trou avant l'aside — mesuré 360px par le DA en comptant le gap). Retiré : la carte
          remplit désormais toute la largeur de sa colonne. Le formulaire n'a aucun paragraphe de
          lecture longue (labels + champs courts + segments), aucun plafond de lecture n'est donc
          perdu. */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <Card className="p-6">
        {/* h2 « Réserver un cours » retiré (B30-5) : doublon du h1 « Réserver avec {prénom} »
            de mes-cours/page.tsx, juste au-dessus. */}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type de cours (EX-028) — KALA : à domicile ou chez le prof */}
        <div>
          <label className="block text-sm font-medium mb-2">Lieu du cours</label>
          <div className="flex gap-2">
            {(['domicile', 'visite'] as const).map((t) => (
              <Button
                key={t}
                type="button"
                variant={typeGarde === t ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTypeGarde(t)}
                // B35-3 (passage 35, MAJEUR) : le variant ghost pose `border-border` — 1,65:1 mesuré
                // contre le fond de carte, sous le seuil non-textuel WCAG 1.4.11 (3:1) sur un
                // segment identifiable UNIQUEMENT par sa bordure. `!important` nécessaire pour
                // gagner sur `border-border` du variant partagé (même spécificité de classe, ordre
                // de génération Tailwind non garanti) sans toucher Button.tsx (impact large sur
                // tous les boutons ghost de l'app, hors périmètre de ce correctif).
                // B37-9 (passage 37, MINEUR) : `size="sm"` (Button.tsx) ne pose aucune hauteur
                // minimale — ces segments mesuraient 34px, sous `min-h-11` (44px) déjà tenu par
                // tous les autres boutons/contrôles du produit. Ajouté ici plutôt que sur
                // `sizeClasses.sm` de Button.tsx (impact large, hors périmètre).
                className={`min-h-11 ${typeGarde === t ? '' : '!border-[color:var(--border-control)]'}`}
              >
                {t === 'domicile' ? 'À domicile' : 'Chez le prof'}
              </Button>
            ))}
          </div>
        </div>

        {/* Dates (EX-028). B41-2 (passage 41, MAJEUR) : `datetime-local` natif retiré — 4 champs
            texte maîtrisés (jj/mm/aaaa + hh:mm), jamais le chrome du navigateur. `max-w-[220px]`
            (DA : un champ de 790px pour ~16 caractères de valeur était aussi un défaut
            d'espacement, pas seulement de format). */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="debut-date" className="block text-sm font-medium mb-1">
              Date de début
            </label>
            <input
              id="debut-date"
              type="text"
              inputMode="numeric"
              placeholder="jj/mm/aaaa"
              value={debutDateStr}
              onChange={(e) => setDebutDateStr(maskDate(e.target.value))}
              maxLength={10}
              className="w-full max-w-[220px] px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg font-mono"
              required
            />
          </div>
          <div>
            <label htmlFor="debut-heure" className="block text-sm font-medium mb-1">
              Heure de début
            </label>
            <input
              id="debut-heure"
              type="text"
              inputMode="numeric"
              placeholder="hh:mm"
              value={debutHeureStr}
              onChange={(e) => setDebutHeureStr(maskTime(e.target.value))}
              maxLength={5}
              className="w-full max-w-[220px] px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg font-mono"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="fin-date" className="block text-sm font-medium mb-1">
              Date de fin
            </label>
            <input
              id="fin-date"
              type="text"
              inputMode="numeric"
              placeholder="jj/mm/aaaa"
              value={finDateStr}
              onChange={(e) => setFinDateStr(maskDate(e.target.value))}
              maxLength={10}
              className="w-full max-w-[220px] px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg font-mono"
              required
            />
          </div>
          <div>
            <label htmlFor="fin-heure" className="block text-sm font-medium mb-1">
              Heure de fin
            </label>
            <input
              id="fin-heure"
              type="text"
              inputMode="numeric"
              placeholder="hh:mm"
              value={finHeureStr}
              onChange={(e) => setFinHeureStr(maskTime(e.target.value))}
              maxLength={5}
              className="w-full max-w-[220px] px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg font-mono"
              required
            />
          </div>
        </div>

        {/* Détails du cours (KALA : instrument, niveau) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="instrument" className="block text-sm font-medium mb-1">
              Instrument / activité
            </label>
            <input
              id="instrument"
              type="text"
              placeholder="ex. Guitare, Piano, Dessin…"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              maxLength={60}
              className="w-full px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg"
              required
            />
          </div>
          <div>
            <label htmlFor="niveau" className="block text-sm font-medium mb-1">
              Niveau de l'élève
            </label>
            <select
              id="niveau"
              value={niveau}
              onChange={(e) => setNiveau(e.target.value as (typeof NIVEAUX)[number])}
              className="w-full px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg"
            >
              {NIVEAUX.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Adresse du domicile de l'élève — requise uniquement pour un cours à domicile */}
        <div>
          <label htmlFor="adresse-eleve" className="block text-sm font-medium mb-1">
            {typeGarde === 'domicile' ? 'Adresse du domicile' : 'Adresse du domicile (facultatif)'}
          </label>
          <input
            id="adresse-eleve"
            type="text"
            placeholder="12 rue de l'École, 25300 Pontarlier"
            value={adresseEleve}
            onChange={(e) => setAdresseEleve(e.target.value)}
            maxLength={160}
            className="w-full px-4 py-2 bg-background-soft border border-[color:var(--border-control)] rounded-lg"
            {...(typeGarde === 'domicile' ? { required: true } : {})}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {typeGarde === 'domicile'
              ? 'Votre prof vient à vous : l\'adresse exacte n\'est communiquée au prof qu\'après confirmation.'
              : 'Renseignée seulement si vous souhaitez être rappelé·e pour organiser le trajet.'}
          </p>
        </div>

        {(error || formError) && (
          <p role="alert" className="text-alerte text-sm">{error || formError}</p>
        )}

        {/* variant="primary", pas "alerte" (B29, passage 29) : le CTA de conversion principal
            portait la couleur terracotta réservée aux états destructifs (règle B14-6) — même
            famille que le bouton « Se déconnecter » du dashboard. Le variant primary rend
            désormais le bon couple mousse clair/texte foncé depuis B28-3. */}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Création...' : 'Continuer vers le paiement'}
        </Button>
      </form>
    </Card>

      {/* Colonne droite (B31-6) : récapitulatif dynamique (dépend de `typeGarde`, doit rester dans
          ce composant client) + rétractation + réassurance — la réassurance réutilise la phrase
          déjà vraie du récap (« le prof perçoit 100 % du tarif affiché »), rien d'inventé. */}
      <div className="space-y-4 xl:sticky xl:top-24">
        <Card className="p-6">
          {/* B35-12 (passage 36, MINEUR) : le rôle "titre de carte latérale" existait en 3 tailles
              (14px /devenir-prof, 16px ici + /timeline, 18px /prof) — unifié sur 18px
              (text-lg), le plus fréquent. Sort du même coup du palier 16px et de son irrégularité
              d'interlignage (16×1,2 = 19,2px via la règle globale h1-h6 line-height:1.2) : plus
              besoin du `leading-6` dédié posé au passage 35. */}
          {/* B40-2 (passage 40, MAJEUR) : dernier titre de carte hors composant partagé
              (CardTitle.tsx couvrait déjà /gains, /dashboard, /devenir-prof,
              /wallet, /timeline — celui-ci vivait ici, dans le composant partagé consommé par
              /mes-cours ET /dashboard, donc invisible aux agents scopés fichier par fichier des
              passages précédents). Convergé sur le même composant : Fraunces 18px/600, text-foreground. */}
          <CardTitle tag="h3">Récapitulatif</CardTitle>
          <div className="space-y-1 text-sm">
            {instrument.trim() && (
              <div className="flex justify-between">
                <span>Cours</span>
                <span>
                  {instrument.trim()} · {niveau}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tarif du cours</span>
              <span>{formatEuros(pricingBreakdown.tarifCents)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Frais de service (9 %)</span>
              <span>+ {formatEuros(pricingBreakdown.fraisServiceCents)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
              <span>Total à payer</span>
              <span>{formatEuros(pricingBreakdown.totalCents)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Le prof perçoit 100 % du tarif affiché ({formatEuros(pricingBreakdown.montantProfCents)}).
            </p>
          </div>
        </Card>

        {/* Mention rétractation L221-28 3° (EX-043) — contenu protégé (§G), adapté au cours.
            B35-6 (passage 35, MOYEN) : p-4 (16px) contre p-6 (24px) de la carte Récapitulatif
            juste au-dessus, dans la MÊME colonne de même largeur — texte décalé de 8px. Règle
            fixée : carte de section = p-6, carte compacte de liste = p-4. Celle-ci est une carte
            de section (mention légale seule dans l'aside), pas un item de liste → p-6. */}
        <div className="bg-card border border-border rounded-lg p-6 text-xs text-muted-foreground">
          <p>
            En validant cette réservation, vous renoncez expressément à votre droit de rétractation de 14 jours
            (article L221-28 3° du Code de la consommation), la prestation de cours étant à exécution immédiate
            ou à date déterminée.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
