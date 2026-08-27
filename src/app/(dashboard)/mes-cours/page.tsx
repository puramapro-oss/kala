/**
 * /mes-cours — Page de réservation d'un cours (Brique 3 EX-028→032, côté page)
 * Route protégée (dans dashboard).
 * Charge le prof via query param `?prof=<id>`, affiche FormulaireReservation,
 * redirige vers confirmation après création.
 */

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase-server';
import { APP_ID, APP_NAME } from '@/lib/constants';
import type { Database } from '@/types/database';
import FormulaireReservation from '@/components/shared/FormulaireReservation';
import AvatarInitiale from '@/components/ui/AvatarInitiale';

// title dédié (B28-9, passage 28) : cet écran partageait le <title> générique de la home.
export const metadata = {
  title: `Réserver un cours · ${APP_NAME}`,
};

type PrestationRow = Database['purama_marketplace']['Tables']['prestations']['Row'];

interface PageProps {
  searchParams: Promise<{ prof?: string }>;
}

async function MesCoursContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const profId = params.prof;

  if (!profId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          {/* B41-10 (passage 41) : 24px/700 hors échelle Syne à 6 paliers (24 est réservé au
              600) — remonté à 30px/700, aligné sur le h1 "Réserver avec {prenom}" de cette même
              page (état alternatif du même rôle sémantique). */}
          <h1 className="text-3xl font-bold mb-4">Prof non spécifié</h1>
          <p className="text-muted-foreground mb-6">
            Veuillez sélectionner un prof depuis la liste des profs disponibles.
          </p>
          {/* B39-7 (passage 39, MOYEN) : CTA écrit à la main sans hauteur explicite (px-6 py-3 ≈
              48px) — aligné sur `Button` (md, h-11=44px, border-2 border-transparent) via ses
              classes exactes, ce `<a>` ne pouvant pas devenir le composant `Button` (rend un
              `<button>`, jamais un lien de navigation). */}
          <a
            href="/#profs"
            className="inline-flex h-11 items-center justify-center rounded-full border-2 border-transparent bg-primary-on-dark px-6 font-semibold text-[#1C1F26] hover:bg-primary-on-dark/90"
          >
            Voir les profs
          </a>
        </div>
      </div>
    );
  }

  const supabase = createServiceClient<Database, 'purama_marketplace'>();

  // 1. Charger le prof (prestataire vérifié) — AVANT le contrôle d'auth (B28-1, passage 28) :
  // l'écran "Connexion requise" ci-dessous doit garder le contexte du prof (avatar/prénom/
  // commune/tarif) pour un visiteur non connecté. Avant ce correctif, le prof n'était chargé
  // qu'APRÈS avoir confirmé un user — un visiteur anonyme (le cas le plus fréquent d'un clic
  // "Réserver" depuis la fiche publique) atterrissait sur une carte anonyme, sans savoir avec qui
  // il était en train de réserver au moment précis où on lui demande le plus d'effort.
  const { data: prof, error: profErr } = await supabase
    .schema('purama_marketplace')
    .from('prestataires')
    .select('*')
    .eq('app_id', APP_ID)
    .eq('id', profId)
    .eq('statut_verification', 'verifie')
    .single();

  if (profErr || !prof) {
    notFound();
  }

  const { data: profilProf } = await supabase
    .schema('purama_marketplace')
    .from('profils')
    .select('affichage_nom, avatar_url')
    .eq('app_id', APP_ID)
    .eq('id', prof.profil_id)
    .single();

  const prenomProf = profilProf?.affichage_nom || 'Prof';
  const avatarProf = profilProf?.avatar_url;

  // 2. Charger prestations du prof (tarifs actifs) — KALA : domicile + visite uniquement
  const { data: prestations } = await supabase
    .schema('purama_marketplace')
    .from('prestations')
    .select('*')
    .eq('app_id', APP_ID)
    .eq('prestataire_id', prof.id)
    .eq('actif', true);

  // Extraire tarifs par type (0 si absent)
  const tarifDomicile =
    prestations?.find((p: PrestationRow) => p.type_garde === 'domicile')?.prix_cents || 0;
  const tarifVisite =
    prestations?.find((p: PrestationRow) => p.type_garde === 'visite')?.prix_cents || 0;
  const tarifMinCents = [tarifDomicile, tarifVisite]
    .filter((t) => t > 0)
    .sort((a, b) => a - b)[0];

  // Vérifier auth serveur — sur le client COOKIE, jamais le client service (B29-1, passage 29,
  // CRITIQUE) : `createServiceClient()` est construit avec `getAll() { return [] }` (aucun cookie,
  // par design — c'est un client service_role backend), donc SON `auth.getUser()` renvoie toujours
  // null. Un utilisateur connecté qui cliquait « Réserver un cours » tombait systématiquement sur
  // « Connexion requise », puis était renvoyé sur /dashboard par le ?next= : la brique B3 entière
  // (réservation) n'avait d'écran accessible pour PERSONNE. Invisible pendant 29 passages parce
  // qu'aucun audit ne s'était jamais authentifié. Règle : client cookie pour QUI est là, client
  // service pour CE QU'on lit/écrit en privilège.
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  // Si non authentifié : afficher CTA login au lieu de redirect (EX-007 : parcours fluide), en
  // gardant le contexte du prof (B28-1) — mêmes classes de bouton que la fiche
  // (`rounded-pill bg-primary-on-dark ... text-[#1C1F26] shadow-lg`, B28-3) plutôt que le couple
  // `bg-primary`/`text-primary-on-dark-foreground` (jeton jamais enregistré, ne générait aucun CSS —
  // même défaut que B26-1), et une sortie explicite vers la fiche plutôt qu'une carte sans issue.
  if (!user) {
    return (
      <div className="min-h-screen bg-background py-8">
        {/* Rail commun de l'app (B29, passage 29) : le conteneur centré max-w-3xl posait le h1 à
            x=369 quand tout le reste de l'app (logo, fiche, home) démarre à x=104 à 1440 — un 3e
            rail pour un seul écran. max-w-7xl px-6 = le rail partagé ; max-w-3xl reste comme
            plafond de largeur de LECTURE, ancré à gauche. */}
        <div className="container mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
          <div className="mb-6">
            <a href={`/prof/${prof.id}`} className="link-nav inline-flex min-h-11 items-center text-sm">
              ← Retour à la fiche du prof
            </a>
          </div>

          <div className="rounded-lg border border-border bg-card p-8">
            <div className="mb-6 flex items-center gap-4">
              <AvatarInitiale prenom={prenomProf} photoUrl={avatarProf} size={64} />
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Réserver un cours avec</p>
                <p className="text-lg font-semibold">{prenomProf}</p>
                <p className="text-sm text-muted-foreground">
                  {prof.commune}
                  {tarifMinCents
                    ? ` · à partir de ${(tarifMinCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                    : ''}
                </p>
              </div>
            </div>

            {/* B41-10 (passage 41) : même correctif que "Prof non spécifié" plus haut — 24/700
                hors échelle, remonté à 30/700. */}
            <h1 className="mb-2 text-3xl font-bold">Connexion requise</h1>
            <p className="text-muted-foreground mb-6">
              Pour réserver un cours avec {prenomProf}, vous devez créer un compte ou vous connecter.
            </p>
            {/* B30-16 : lien « Revenir à la fiche de {prenom} » retiré — doublon sans affordance
                (175 × 20 px, pas de soulignement au repos) de « ← Retour à la fiche du prof »
                déjà présent 300 px plus haut, même destination (convention de /cgv : on garde celui
                du haut). */}
            <div className="flex flex-col items-start gap-3">
              {/* B39-7 (passage 39, MOYEN) : même unification que le CTA « Voir les profs »
                  plus haut — hauteur explicite alignée sur `Button` (lg, h-14=56px, cohérent avec
                  px-8 déjà en place), border-2 border-transparent. */}
              <a
                href={`/login?next=${encodeURIComponent(`/mes-cours?prof=${prof.id}`)}`}
                className="inline-flex h-14 items-center justify-center rounded-pill border-2 border-transparent bg-primary-on-dark px-8 font-semibold text-[#1C1F26] shadow-lg transition hover:opacity-90"
              >
                Se connecter / S'inscrire
              </a>
            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Pas de callback succès ici (B29, passage 29) : une FONCTION passée en prop d'un Server
  // Component à un Client Component crashe tout l'écran (« Event handlers cannot be passed to
  // Client Component props ») — la redirection de succès vit dans FormulaireReservation lui-même.

  return (
    // B38-10 (passage 38, MOYEN) : `min-h-screen` (piège B25-8) empilait ce conteneur SOUS le
    // header en haut de page — sur cet écran court (formulaire + récap), 206px de noir restaient
    // entre le dernier contenu et le pied de page à 1440 (>1/4 de la hauteur totale). `flex-1`
    // (au lieu de `min-h-screen`) fait grandir ce conteneur jusqu'à occuper exactement l'espace
    // que lui laisse `main` (déjà `flex-1 flex flex-col`, cf. layout.tsx).
    // B40-5 (passage 40) : `justify-center` (choix de B38-10) centrait le bloc verticalement — h1
    // à y=238 contre le gabarit d'en-tête tenu par /wallet, /timeline, /devenir-prof (h1.top ∈
    // [105;115] à 1440). Retiré, le flux normal reprend le dessus, `align-items` reste au défaut
    // `stretch` (rail intact à x=104).
    <div className="flex flex-1 flex-col bg-background py-8">
      {/* Rail commun (B29, passage 29) : même correctif que la branche « Connexion requise »
          ci-dessus — conteneur max-w-7xl px-6 partagé, largeur de lecture 3xl ancrée à gauche.
          xl:max-w-none (B31-6) : au-delà de 3xl (768 px), FormulaireReservation pose son propre
          récapitulatif en colonne collante (carte 32rem + gap 32 + 360 = 904 px) — un plafond à
          768 px la ferait déborder. Sous xl, rien ne change : 3xl reste le plafond de lecture. */}
      <div className="container mx-auto max-w-7xl px-6">
        <div className="max-w-3xl xl:max-w-none">
        <div className="mb-6">
          <a href={`/prof/${prof.id}`} className="link-nav inline-flex min-h-11 items-center text-sm">
            ← Retour à la fiche du prof
          </a>
        </div>

        {/* En-tête riche identique au gate déconnecté ci-dessus (B30-5) : avatar 40px + prénom réel
            du prof + commune, plutôt que « Prof : {prof.titre} » (le titre d'annonce, pas
            un nom de personne).
            B38-2/B38-3 (passage 38, MAJEUR) : l'avatar en flux (`flex items-center gap-3`, avatar
            avant le texte) poussait le H1 de 40+12=52px par rapport au rail de la page (mesuré
            x=156 contre rail 104 à 1440, exactement +52px, sur les 3 largeurs) — même mécanisme et
            même correctif que B38-2 : empilement vertical (avatar au-dessus, pas à côté) plutôt
            qu'un negative margin, pour rester aligné au rail à toute largeur sans faire sortir
            l'avatar du cadre à 375. */}
        <div className="mb-6 flex flex-col items-start gap-3">
          <AvatarInitiale prenom={prenomProf} photoUrl={avatarProf} size={40} />
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Réserver un cours avec {prenomProf}</h1>
            <p className="text-sm text-muted-foreground">
              {prof.commune}
              {tarifMinCents
                ? ` · à partir de ${(tarifMinCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
                : ''}
            </p>
          </div>
        </div>

        <FormulaireReservation
          prestataireId={prof.id}
          tarifDomicileCents={tarifDomicile}
          tarifVisiteCents={tarifVisite}
        />
        </div>
      </div>
    </div>
  );
}

export default async function MesCoursPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Chargement...</div>}>
      <MesCoursContent searchParams={searchParams} />
    </Suspense>
  );
}
