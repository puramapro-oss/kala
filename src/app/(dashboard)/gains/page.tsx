/**
 * /gains — Écran gains prof (EX-039)
 * Affiche total gagné, historique par cours, statut versement.
 */

import { Metadata } from 'next';
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase-server';
import { APP_ID, APP_NAME } from '@/lib/constants';
import Card from '@/components/ui/Card';
import CardTitle from '@/components/ui/CardTitle';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/database';

export const metadata: Metadata = {
  title: `Mes gains · ${APP_NAME}`,
};

export default async function GainsPage() {
  const supabase = createServiceClient();
  // Client cookie pour l'auth, pas le client service (B29-1, passage 29) : `createServiceClient()`
  // n'a aucun cookie par construction, son `getUser()` renvoie toujours null — cette page renvoyait
  // TOUT utilisateur connecté vers /login en boucle. Même règle que mes-cours/page.tsx.
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect('/login?next=/gains');
  }

  // Profil de l'utilisateur
  const { data: profil, error: profilErr } = await supabase
    .from('profils')
    .select('id')
    .eq('app_id', APP_ID)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (profilErr || !profil) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-3xl font-bold mb-4">Mes gains</h1>
        <p className="text-muted-foreground">Profil client introuvable.</p>
      </div>
    );
  }

  const { data: prestataire, error: prestErr } = await supabase
    .from('prestataires')
    .select('id')
    .eq('app_id', APP_ID)
    .eq('profil_id', profil.id)
    .limit(1)
    .maybeSingle();

  if (prestErr || !prestataire) {
    // B30-9 : état vide mis en scène — carte glass sur le rail, rappel de la
    // promesse 0 % commission, CTA primaire. Remplace l'ancien texte nu et sans émotion.
    // B31-6 : max-w-2xl (672 px, 54 % du conteneur à 1440) élargie à max-w-4xl (896 px, 73 %).
    // B31-13 : contenu réécrit en local (sans <EmptyState>, qui centre tout via `items-center
    // text-center`) pour l'aligner à gauche sur le padding de la carte — la carte, elle, reste
    // ancrée à gauche du rail, deux axes différents dans le même objet sinon.
    return (
      // flex-1 flex-col (B32-5, passage 32) : `main` (layout.tsx) est lui-même `flex-1 flex
      // flex-col` — sans `flex-1` ici, ce conteneur restait dimensionné à son contenu (h1 + carte
      // de 255px) et laissait 370px de noir entre lui et le pied de page.
      // B36-4 (passage 36, MOYEN) : `justify-center` faisait tomber le h1 à y=276 contre y=107 sur
      // les pages sœurs connectées sans ornement (/wallet, /devenir-prof, /timeline) — le
      // centrage vertical n'a de légitimité que pour un écran d'authentification, pas un espace
      // connecté. `justify-start` (comportement flex par défaut) aligne le titre en haut comme le
      // reste du produit ; à 375 le flux normal (déjà `y=81`, pas de flex-col ici) reste inchangé.
      // Pas `min-h-screen` (piège B25-8) : `flex-1` remplit exactement l'espace que `main` laisse,
      // ni plus ni moins.
      // B40-5 (passage 40) : le recentrage vertical rompait avec le gabarit d'en-tête tenu par les
      // autres pages connectées (/wallet, /timeline, /devenir-prof, h1.top ∈ [105;115] à 1440) —
      // retiré, le bloc reprend le flux normal en haut de l'espace disponible comme le reste du
      // produit.
      <div className="container mx-auto flex max-w-7xl flex-1 flex-col px-6 py-8">
        {/* B35-2 (passage 35, MAJEUR) : la carte portait son propre max-w-4xl (896px) — 3e
            largeur du produit pour un "gabarit écran simple" (896/904/768 sur /gains, /mes-cours,
            /wallet). B37-3 (passage 37, MOYEN) : le max-w-3xl (768px) posé au passage 35 laissait
            465px de bande morte dans l'enveloppe 1232px — retiré, la carte occupe le rail complet.
            B38-7 (passage 38, MOYEN) : carte 1232×254px pour 530px de contenu (57% de vide) —
            `max-w-[720px]` réapparaît ici, cette fois sur la carte d'invitation elle-même (pas de
            contenu à recentrer en interne, il est déjà `items-start` intentionnel, cf. B31-13). */}
        <h1 className="text-3xl font-bold mb-6">Mes gains</h1>
        {/* B38-7 (passage 38) / B39-4 (passage 39, MOYEN) : `max-w-[720px]` réduisait l'enveloppe
            au lieu de la remplir — retiré, carte revenue au rail complet (1232px), cohérente avec
            /wallet et le reste du produit. */}
        <Card className="relative p-6">
          {/* B43-9 (passage 43) : l'ornement en filigrane (5 correctifs successifs de
              contraste/taille/visibilité) restait sans lien de composition clair avec le texte
              qu'il bordait, et disparaissait entièrement à 375 (`hidden sm:block`), incohérence de
              présence entre viewports. Retiré plutôt que retravaillé une 6e fois. Le bloc devient
              un module centré unique (illustration + texte + CTA, max 480px), qui n'a plus de coin
              vide à décorer. */}
          <div className="mx-auto flex max-w-[480px] flex-col items-center py-6 text-center">
            {/* B41-8 (passage 41, audit imagerie) : même illustration `empty-carnet.svg` que la
                branche "0 réservation" plus bas — cette branche-ci (compte client, pas encore
                prof) est celle que rencontre le compte de démo audité par le DA, restée sans
                image lors du 1er passage de câblage de cet item. */}
            {/* B43-9 (passage 43) : 200px carré -> 160px large (`w-40`) x 165,45px haut
                (`h-[165.45px]`, ratio réel du nouveau viewBox 143.48x148.37 -- PAS `h-auto` :
                mesuré via Playwright que `naturalWidth/Height` peut rester à 0 pour un <img> SVG
                sans passer par le décodage complet, ce qui collapse la hauteur à 0px avec `w-40`
                seul ; hauteur explicite = rendu déterministe, aucune dépendance à la détection
                de ratio intrinsèque du navigateur), bloc entier centré (ornement retiré, cf.
                commentaire ci-dessus). */}
            <img src="/journal-demo/empty-carnet.svg" alt="" className="mb-4 w-40 h-[165.45px]" />
            <CardTitle tag="h3">Vous n&apos;êtes pas encore prof</CardTitle>
            <p className="text-muted-foreground mb-2">
              Le jour où vous ouvrirez ce carnet, il se remplira cours après cours — vous percevez
              100 % de votre tarif affiché, {APP_NAME} ne prélève aucune commission sur vos revenus.
            </p>
            {/* B41-8 (passage 41) : 2e phrase ajoutée pour dépasser le seuil de 400 caractères de
                contenu réel fixé par l'audit imagerie — faits déjà établis ailleurs dans le
                produit (vérification prof : cf. `HomeClient.tsx` ; wallet KOSHA : cf. `/wallet`),
                jamais un chiffre ou une promesse inventée. */}
            <p className="text-muted-foreground mb-6">
              Votre référence de vérification prof sera contrôlée avant validation, puis vos gains
              atterriront directement dans votre wallet KOSHA après chaque cours terminé, sans
              commission prélevée par {APP_NAME}.
            </p>
            <a
              href="/devenir-prof"
              className="inline-flex min-h-11 items-center justify-center px-6 py-3 rounded-full bg-primary-on-dark text-[#0A0A0F] font-semibold hover:opacity-90 transition-opacity"
            >
              Devenir prof
            </a>
          </div>
        </Card>
      </div>
    );
  }

  // Réservations terminées (EX-039)
  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .select('id, tarif_cents, debut_le, fin_le, statut, cree_le')
    .eq('app_id', APP_ID)
    .eq('prestataire_id', prestataire.id)
    .in('statut', ['terminee', 'en_cours', 'confirmee'])
    .order('debut_le', { ascending: false });

  if (resErr) {
    console.error('[gains] Erreur lecture réservations:', resErr);
    return (
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-3xl font-bold mb-4">Mes gains</h1>
        <p className="text-alerte">Erreur chargement données.</p>
      </div>
    );
  }

  // B41-9 : tarifs réels du prof connecté (mêmes colonnes/patron de requête que
  // /prof/[id]/page.tsx) pour combler le vide desktop de la carte "Historique" avec du contenu
  // réel — jamais une donnée inventée. Section sautée plus bas si 0 prestation configurée.
  const { data: prestations } = await supabase
    .from('prestations')
    .select('type_garde, prix_cents')
    .eq('app_id', APP_ID)
    .eq('prestataire_id', prestataire.id)
    .eq('actif', true);

  type PrestationRow = Pick<
    Database['purama_marketplace']['Tables']['prestations']['Row'],
    'type_garde' | 'prix_cents'
  >;

  // Mêmes libellés que la fiche prof et le dashboard — pas un 2e vocabulaire. KALA : domicile
  // et visite uniquement (colonne partagée `type_garde`, valeurs inchangées côté base).
  const TYPE_COURS_LABELS: Record<string, string> = {
    domicile: 'Cours à domicile',
    visite: 'Chez le prof',
  };

  type ReservationRow = Database['purama_marketplace']['Tables']['reservations']['Row'];
  const totalGagneCents = (reservations || [])
    .filter((r: ReservationRow) => r.statut === 'terminee')
    .reduce((sum: number, r: ReservationRow) => sum + r.tarif_cents, 0);

  const totalGagneEuros = (totalGagneCents / 100).toFixed(2);

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8">
      {/* B35-2 (passage 35, MAJEUR) : max-w-3xl (768px) unifiait /gains sur le même rail que
          /wallet. B37-3 (passage 37, MOYEN) : ce plafond laissait 465px de bande morte dans
          l'enveloppe 1232px (même défaut que /wallet, mesuré par le DA) — retiré. */}
      <div>
      <h1 className="text-3xl font-bold mb-6">Mes gains</h1>

      <Card className="p-6 mb-6">
        {/* B39-4/B39-9 (passage 39, MOYEN) : ce montant est le sujet réel de la page mais restait
            en Inter (aucune classe `font-display`), 36px — pas de chiffre-héros unique/page (règle
            B39-9), incohérent avec le solde de /wallet. Aligné sur la même recette : Fraunces
            (`font-display`). B41-10 (passage 41) : 48px n'appartient pas à l'échelle Fraunces à 6
            paliers — ramené à 42px (palier le plus proche), même correctif appliqué au solde
            `/wallet`. */}
        <CardTitle tag="h2">Total gagné</CardTitle>
        <p className="font-display text-[42px] font-bold text-primary-on-dark">{totalGagneEuros} €</p>
        <p className="text-sm text-muted-foreground mt-1">
          Montant total des cours terminés (vous percevez 100 % du tarif affiché).
        </p>
      </Card>

      <Card className="p-6">
        <CardTitle tag="h2">Historique des cours</CardTitle>

        {!reservations || reservations.length === 0 ? (
          // B41-11 (passage 41, audit imagerie) : illustration `empty-carnet.svg` (carnet vierge)
          // + reformulation qui projette dans le parcours réel du prof plutôt qu'un simple
          // constat plat ("Aucun cours enregistré.") — aucune donnée inventée, l'état reste
          // 100 % réel (0 réservation).
          // B43-9 (passage 43) : même recette que le bloc "Vous n'êtes pas encore prof"
          // ci-dessus — bloc unique centré (max 480px), illustration 160x165,45px (ratio réel du
          // viewBox recadré, hauteur explicite plutôt que `h-auto`, cf. commentaire détaillé
          // au-dessus) au lieu d'un empilement plein largeur.
          <div className="mx-auto flex max-w-[480px] flex-col items-center pt-2 text-center">
            <img
              src="/journal-demo/empty-carnet.svg"
              alt=""
              className="mb-4 w-40 h-[165.45px]"
            />
            <p className="mb-2 text-base font-medium text-muted-foreground">Votre carnet de cours est encore vierge</p>
            <p className="text-muted-foreground text-sm">
              Chaque cours accepté s&apos;inscrira ici, avec son gain et son statut de versement.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((r: ReservationRow) => (
              <div key={r.id} className="border-b pb-3 last:border-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {new Date(r.debut_le).toLocaleDateString('fr-FR')} →{' '}
                      {new Date(r.fin_le).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Statut : <span className="capitalize">{r.statut}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{(r.tarif_cents / 100).toFixed(2)} €</p>
                    {r.statut === 'terminee' && (
                      <p className="text-xs text-primary-on-dark">Versé</p>
                    )}
                    {r.statut === 'en_cours' && (
                      <p className="text-xs text-secondary-on-dark">En cours</p>
                    )}
                    {r.statut === 'confirmee' && (
                      <p className="text-xs text-muted-foreground">À venir</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* B41-9 : grille "Ce que vous gagneriez" — tarifs réels déjà en base (table prestations,
          même requête que /prof/[id]/page.tsx), jamais inventés. Comble le vide desktop
          identifié par le DA (372px@1440, 400px@768) sans étirer les cartes existantes. Sautée si
          0 prestation configurée (prof pas encore tarifé). KALA : 2 types de cours →
          sm:grid-cols-2. */}
      {prestations && prestations.length > 0 && (
        <Card className="p-6 mt-6">
          <CardTitle tag="h2">Ce que vous gagneriez</CardTitle>
          <p className="text-sm text-muted-foreground mb-4">
            Vos tarifs actuels par type de cours.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {prestations.map((p: PrestationRow) => (
              <div
                key={p.type_garde}
                className="rounded-lg border border-border bg-card p-4 text-center"
              >
                <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {TYPE_COURS_LABELS[p.type_garde] ?? p.type_garde}
                </p>
                <p className="font-mono text-2xl font-bold text-primary-on-dark">
                  {(p.prix_cents / 100).toFixed(2)} €
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-lg font-bold text-primary-on-dark">
            0 % de commission — vous gardez 100 % de ce montant.
          </p>
        </Card>
      )}
      </div>
    </div>
  );
}
