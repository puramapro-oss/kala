/**
 * /dashboard — Accueil de l'espace connecté (B29-2, passage 29 : l'écran était un stub —
 * email brut en guise de bienvenue et un unique bouton terracotta « Se déconnecter », seul objet
 * saturé de l'app authentifiée. Reconstruit sur les vraies données : prénom du profil, prochain
 * cours, compteurs réels (0 si 0, jamais inventés — CLAUDE.md §3), accès aux flux existants.
 * La déconnexion redevient une action discrète en pied d'écran, pas l'action principale.)
 */

import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { APP_ID, APP_NAME } from '@/lib/constants';
import type { Database } from '@/types/database';
import type { Metadata } from 'next';
import Card from '@/components/ui/Card';
import CardTitle from '@/components/ui/CardTitle';
import AvatarInitiale from '@/components/ui/AvatarInitiale';
import DashboardConfirmation from '@/components/dashboard/DashboardConfirmation';
import { formatPourcent, formatPlageCompacte } from '@/lib/format';

export const metadata: Metadata = {
  title: `Mon espace · ${APP_NAME}`,
};

type ReservationRow = Database['purama_marketplace']['Tables']['reservations']['Row'];

// Mêmes libellés que la fiche prof et le formulaire de réservation (prestations `type_garde`
// 'domicile'/'visite') — KALA : pas de 2e vocabulaire pour le même type de prestation.
const TYPE_COURS_LABELS: Record<string, string> = {
  domicile: 'Cours à domicile',
  visite: 'Chez le prof',
};

// B43-8 : mêmes libellés que `EntreeTimelineCard` (cours/[id]/timeline/page.tsx) — pas un
// 2e vocabulaire pour le même type d'entrée. KALA : photo et note uniquement.
const TYPE_ENTREE_LABELS: Record<string, string> = {
  photo: 'Photo',
  note: 'Note',
};

export default async function DashboardPage() {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = createServiceClient();

  const { data: profil } = await supabase
    .from('profils')
    .select('id, affichage_nom')
    .eq('app_id', APP_ID)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  // Prénom du profil, jamais l'email brut (B29-2) — repli sur la partie locale de l'email
  // uniquement si le trigger de création de profil n'a pas encore tourné.
  const prenom = profil?.affichage_nom || user.email?.split('@')[0] || 'vous';

  let prochaineCours: ReservationRow | null = null;
  let nbReservationsAVenir = 0;
  let prochaineCoursProf: string | null = null;
  let nbEntreesTimeline = 0;
  // B43-8 (passage 43) : dernières entrées réelles (pas juste le compte déjà affiché plus haut) —
  // alimente la 3e rangée "Dernières entrées de la timeline" qui absorbe le vide de pied de page.
  let dernieresEntrees: Array<{ id: string; type: string; survenu_le: string }> = [];

  if (profil) {
    const nowIso = new Date().toISOString();

    // B30-1 (CRITIQUE) : le statut fait foi pour 'en_cours' — AUCUN filtre de date. Un cours en
    // cours reste affiché même si `fin_le` calculé est déjà proche ou dépassé (le prof n'a pas
    // encore clôturé), sinon la timeline redevient injoignable depuis le tableau de bord dès que
    // l'horloge dépasse la fin théorique. Seules les 'confirmee' (pas encore commencées)
    // sont filtrées sur une date à venir.
    const { data: coursEnCours } = await supabase
      .from('reservations')
      .select('*')
      .eq('app_id', APP_ID)
      .eq('client_profil_id', profil.id)
      .eq('statut', 'en_cours')
      .order('debut_le', { ascending: true })
      .limit(1)
      .maybeSingle();

    prochaineCours = coursEnCours ?? null;

    if (!prochaineCours) {
      const { data: coursConfirme } = await supabase
        .from('reservations')
        .select('*')
        .eq('app_id', APP_ID)
        .eq('client_profil_id', profil.id)
        .eq('statut', 'confirmee')
        .gte('debut_le', nowIso)
        .order('debut_le', { ascending: true })
        .limit(1)
        .maybeSingle();
      prochaineCours = coursConfirme ?? null;
    }

    const { count: resaCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('app_id', APP_ID)
      .eq('client_profil_id', profil.id)
      .in('statut', ['confirmee', 'en_cours']);
    nbReservationsAVenir = resaCount ?? 0;

    if (prochaineCours) {
      const { data: prest } = await supabase
        .from('prestataires')
        .select('profil_id')
        .eq('app_id', APP_ID)
        .eq('id', prochaineCours.prestataire_id)
        .single();
      if (prest) {
        const { data: profilProf } = await supabase
          .from('profils')
          .select('affichage_nom')
          .eq('app_id', APP_ID)
          .eq('id', prest.profil_id)
          .single();
        prochaineCoursProf = profilProf?.affichage_nom ?? null;
      }

      if (prochaineCours.statut === 'en_cours') {
        // Table partagée purama_marketplace.journal_garde (nom immuable) — KALA l'utilise comme
        // timeline du cours (entrées photo/note).
        const { count: timelineCount } = await supabase
          .from('journal_garde')
          .select('id', { count: 'exact', head: true })
          .eq('app_id', APP_ID)
          .eq('reservation_id', prochaineCours.id);
        nbEntreesTimeline = timelineCount ?? 0;

        // B43-8 : 3 dernières entrées réelles (type + horodatage), pas seulement le compte — sert
        // la 3e rangée "Dernières entrées de la timeline" du dashboard (comble le vide de pied de
        // page avec du contenu utile, jamais inventé).
        const { data: entreesRows } = await supabase
          .from('journal_garde')
          .select('id, type, survenu_le')
          .eq('app_id', APP_ID)
          .eq('reservation_id', prochaineCours.id)
          .order('survenu_le', { ascending: false })
          .limit(3);
        dernieresEntrees = (entreesRows ?? []) as Array<{
          id: string;
          type: string;
          survenu_le: string;
        }>;
      }
    }
  }

  // Côté prof : le profil prestataire de l'utilisateur, s'il existe
  const { data: prestataire } = profil
    ? await supabase
        .from('prestataires')
        .select('id, statut_verification')
        .eq('app_id', APP_ID)
        .eq('profil_id', profil.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  return (
    // <div>, pas <main> (famille B23-4) : layout.tsx fournit déjà le landmark <main>.
    <div className="flex-1 bg-background">
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <Suspense>
          <DashboardConfirmation />
        </Suspense>

        {/* B40-9 (passage 40) : le filigrane forme d'onde flottant seul au-dessus du h1 (glyphe
            orphelin sans libellé ni rôle, ~50% d'opacité) a été retiré — il lisait comme un défaut
            plutôt qu'une signature. Historique des compensations de rotation (B27-9/B34-8/B35-13)
            devenu obsolète avec cette suppression. */}
        {/* B33-6 (passage 33) : « Se déconnecter » sort du flux principal — la déconnexion est
            une action d'entretien, sa place est dans l'en-tête de la page, pas comme dernier
            élément de la page d'accueil connectée. Bouton discret, jamais en terracotta/alerte. */}
        <div className="mb-2 flex items-start justify-between gap-4">
          {/* B37-5 (passage 37, MOYEN) : `md:text-4xl` (36px) était la seule des 6 pages
              connectées à faire grandir son h1 au-delà de 30px — /wallet, /gains, /devenir-prof,
              /timeline restent toutes à 30px. Aucune trace d'un arbitrage délibéré pour cette
              salutation dans DECISIONS.md ni en commentaire ici : pas un cran "hero" volontaire
              (contrairement à la fiche publique /prof 42px, documenté ailleurs comme choix héros
              de fiche publique) — uniformisé sur le cran commun. */}
          <h1 className="text-3xl font-bold tracking-tight">Bonjour, {prenom}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="/ma-memoire"
              className="min-h-11 flex items-center rounded-lg border border-[color:var(--border-control)] px-4 py-2 text-sm text-muted-foreground transition hover:bg-background-soft/50 hover:text-foreground"
            >
              Ma mémoire
            </a>
            <form action="/api/auth/signout" method="POST">
              {/* B35-3 (passage 35, MAJEUR) : bordure mesurée 1,53:1 — sous le seuil non-textuel
                  1.4.11 (3:1). border-control (3,26:1) remplace border-border. */}
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-[color:var(--border-control)] px-4 py-2 text-sm text-muted-foreground transition hover:bg-background-soft/50 hover:text-foreground"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
        <p className="mb-8 text-lg text-muted-foreground">Votre espace {APP_NAME}</p>

        {/* B33-6 : « Vos cours » porte la seule information vivante de l'écran — pleine largeur
            du rail (md:col-span-2) — pendant que « Côté prof » occupe la seconde rangée, plutôt
            que des cartes en escalier de hauteurs indépendantes. */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Prochain cours / réservations — B30-1 (CRITIQUE) : c'est le point d'entrée manquant
              de la timeline. Un cours en_cours affiche le nom réel du prof (« Cours avec
              {prof} »), le nombre d'entrées déjà partagées, et un lien primaire direct vers la
              timeline — plus une carte muette qui n'y menait jamais. */}
          {/* B34-2 (passage 34, MAJEUR) : la carte occupait déjà 1232 px de rail (B33-6) mais son
              contenu restait empilé dans les 251 premiers pixels — 956 px vides à droite (78 % de
              la carte). Puisque la carte est HORIZONTALE, son contenu l'est aussi à partir de md :
              info à gauche, compteur au centre (séparé par un filet, uniquement si un cours est
              en cours), actions à droite — la même information, distribuée sur toute la largeur
              plutôt qu'empilée dans une seule colonne étroite. */}
          <Card className="border border-border p-6 md:col-span-2">
            <CardTitle>Vos cours</CardTitle>
            {/* B36-5 (passage 36, MOYEN) : `justify-between` sur les 3 groupes distribués via
                `md:max-w-4xl` (896px) laissait 287px de vide entre le bouton d'action (fin du
                plafond) et le bord réel de la carte (1312px) — remplacé par une grille
                `[1fr_auto_auto]` SANS plafond.
                B38-8 (passage 38, MAJEUR, régression du fix B36-5, corrigée 2 fois ce passage) :
                1re tentative (grid `[1fr_auto]` + `max-w-[560px]` sur la colonne info, recette
                initiale DA) VÉRIFIÉE FAUSSE par capture après coup — `1fr` est PAR DÉFINITION
                "tout le reliquat" : la colonne `auto` suivante démarre TOUJOURS à la fin de la
                piste `1fr`, jamais à la fin du TEXTE réellement rendu à l'intérieur (`max-width`
                plafonne la boîte, pas la piste de grille qui la contient) — capture Playwright
                après ce premier correctif : texte visible fini vers x≈290, "5"/actions démarrent
                encore à x=1002, vide quasi intact. Fix (passage 38) : abandon de `1fr` — `md:flex`
                sans `justify-between`, reliquat de largeur en fin de ligne APRÈS les actions.
                B43-8 (passage 43, régression assumée de B38-8) : mesure DA/audit — la carte ne
                remplissait que 38% de son rail (470,6px d'encre / 1232px, 736,4px de vide à
                droite) car les 2 blocs restaient collés à gauche, tout le reliquat de largeur
                repoussé APRÈS les actions (invisible, hors du champ de vision naturel). Cette
                fois le gabarit demandé est explicitement 2 colonnes (récit à gauche, actions
                ancrées au bord droit RÉEL de la carte) — `md:justify-between` réintroduit
                volontairement : avec exactement 2 blocs, l'un démarre au bord gauche, l'autre
                finit au bord droit, aucun "canyon" central hasardeux (le risque documenté par
                B38-8 concernait un `grid [1fr_auto_auto]` à 3 pistes, pas ce cas à 2 blocs
                `flex`). `gap-8` conservé comme espacement plancher si le conteneur devait un
                jour rétrécir sous la somme des 2 largeurs de contenu. `max-w-[560px]` conservé
                sur le bloc info comme garde-fou anti-régression si un texte très long réapparaît
                un jour (n'a plus d'effet aujourd'hui, texte toujours plus court). */}
            <div className="md:flex md:items-center md:justify-between md:gap-8">
              {prochaineCours ? (
                <div className="max-w-[560px] shrink-0 space-y-1">
                  {prochaineCours.statut === 'en_cours' && prochaineCoursProf ? (
                    <p className="font-semibold">
                      Cours en cours avec {prochaineCoursProf}
                    </p>
                  ) : (
                    <p className="font-semibold">
                      {TYPE_COURS_LABELS[prochaineCours.type_garde] ?? prochaineCours.type_garde}
                      {prochaineCoursProf ? ` avec ${prochaineCoursProf}` : ''}
                    </p>
                  )}
                  {/* B34-6 : plage compacte unifiée (cartes/listes) — jamais un 3e format de date. */}
                  {/* S42-e : plage de dates + compteur de réservations = données secondaires
                      d'accompagnement (pas la donnée mise en avant de la carte) → font-medium (500). */}
                  <p className="text-sm text-muted-foreground font-mono font-medium">
                    {formatPlageCompacte(prochaineCours.debut_le, prochaineCours.fin_le)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono font-medium">{nbReservationsAVenir}</span> réservation{nbReservationsAVenir > 1 ? 's' : ''} à venir
                  </p>
                </div>
              ) : (
                <p className="max-w-[560px] text-sm text-muted-foreground">
                  Aucun cours à venir. Trouvez un prof vérifié près de chez vous.
                </p>
              )}

              {/* mt-4/md:mt-0 porté par ce wrapper (pas par ses 2 enfants séparément, B38-8) :
                  colonne verticale sur mobile (compteur puis actions, gap-4), ligne horizontale à
                  partir de md (compteur puis actions, gap-6) — 2e (et dernier) enfant du flex row
                  parent, juste après le bloc info, jamais poussé au bord droit de la carte. */}
              <div className="mt-4 flex flex-col gap-4 md:mt-0 md:flex-row md:items-center md:gap-6 md:shrink-0">
                {prochaineCours?.statut === 'en_cours' && (
                  // B38-16 (passage 38) : Anonymous Pro au lieu de Syne — réglait la famille,
                  // pas le poids. B39-3 (passage 39, MOYEN) : DA mesure que ce compteur (28px/600,
                  // seul accent vert `--primary-on-dark` de la carte) reste le premier objet que
                  // l'œil attrape, devant le sujet réel "Cours avec Marie" (Inter 16px blanc,
                  // bloc précédent) — un chiffre d'inventaire ne doit jamais dominer le sujet.
                  // Recette : taille ramenée à un cran sous le corps de texte (14px, pas 28px),
                  // graisse 500 (pas 600), couleur neutre `text-muted-foreground` (l'accent vert
                  // est réservé aux vrais CTA/succès, pas à un simple compte). Le chiffre reste
                  // avant son libellé (repère de lecture rapide déjà validé), juste sans plus
                  // peser que le texte qui l'entoure.
                  // B41-10 (passage 41) : 16px sortait de l'échelle Anonymous Pro à 3 paliers
                  // (12/14/20, alignée sur les 3 diamètres d'avatar) — ramené à 14px.
                  // B41-6 (passage 41, DA contre-audit) : AVANT — `text-center` restait sur ce
                  // bloc (seul texte centré de toute la carte) alors que le sujet au-dessus est
                  // `start` par défaut ; retiré, le compteur suit le même alignement que le reste
                  // de la carte. Le séparateur vertical (`md:border-r`) ne courait que sur les
                  // 50px de ce bloc au milieu d'une carte de 180px : `md:self-stretch` (le bloc
                  // s'étire sur toute la hauteur de la rangée compteur/actions, `align-self`
                  // l'emporte sur le `md:items-center` du parent) + `md:flex md:flex-col
                  // md:justify-center` (les 2 lignes de texte restent centrées verticalement dans
                  // ce bloc désormais plus haut) fait courir le filet sur toute la hauteur réelle
                  // plutôt que de le supprimer. */}
                  <div className="shrink-0 border-t border-border pt-4 md:flex md:flex-col md:justify-center md:self-stretch md:border-t-0 md:border-r md:border-border md:pr-6 md:py-1">
                    <p className="font-mono text-sm font-medium leading-none text-muted-foreground">
                      {nbEntreesTimeline}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      entrée{nbEntreesTimeline > 1 ? 's' : ''} dans la timeline
                    </p>
                  </div>
                )}

                {/* B41-6 (passage 41, DA contre-audit) : conteneur toujours `flex-col
                    items-start` (pas de bascule par breakpoint) — bouton et lien empilés,
                    alignés sur le même bord gauche, à 375 comme à 1440. */}
                <div className="flex flex-col items-start gap-2">
                  {prochaineCours?.statut === 'en_cours' ? (
                    <a
                      href={`/cours/${prochaineCours.id}/timeline`}
                      className="inline-flex min-h-11 items-center rounded-pill bg-primary-on-dark px-6 py-3 text-sm font-semibold text-[#1C1F26] shadow-lg transition hover:opacity-90"
                    >
                      Voir la timeline
                    </a>
                  ) : (
                    <a
                      href="/#profs"
                      className="inline-flex min-h-11 items-center rounded-pill bg-primary-on-dark px-6 py-3 text-sm font-semibold text-[#1C1F26] shadow-lg transition hover:opacity-90"
                    >
                      Trouver un prof
                    </a>
                  )}
                  {/* Complément dispatcher (passage 33) : /wallet a 0 lien entrant sur tout le
                      produit — lien texte souligné, JAMAIS un second bouton plein (le bouton
                      primaire unique est un acquis protégé §G).
                      B35-11 (passage 35, MINEUR) : règle bronze/vert par domaine, ABANDONNÉE par
                      B39-10 (passage 39, MOYEN) : le DA mesure 5 traitements de lien coexistants
                      et fixe une règle unique — deux rôles seulement, jamais un 3e axe de sens
                      porté par la couleur. `.link-action` (`--primary-on-dark` souligné) pour
                      tout lien d'action dans le contenu ; la terre redevient un accent décoratif
                      (avatars/badges), plus une couleur de lien. */}
                  <a href="/wallet" className="link-action inline-flex min-h-11 items-center text-sm font-medium">
                    Wallet KOSHA
                  </a>
                </div>
              </div>
            </div>
          </Card>

          {/* Espace prof — état selon le profil prestataire réel */}
          <Card className="border border-secondary-on-dark/40 p-6 space-y-3 h-full">
            <CardTitle>Côté prof</CardTitle>
            {prestataire?.statut_verification === 'verifie' ? (
              <>
                <p className="text-sm text-muted-foreground">Votre profil prof est vérifié.</p>
                <a href="/gains" className="link-action inline-flex min-h-11 items-center text-sm font-medium">
                  Voir mes gains
                </a>
              </>
            ) : prestataire ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Votre profil prof est en cours de vérification.
                </p>
                <a href="/devenir-prof" className="link-action inline-flex min-h-11 items-center text-sm font-medium">
                  Compléter mon profil
                </a>
              </>
            ) : (
              <>
                {/* S42-e : "0%" est une valeur mise en avant (stat/pourcentage) → 700→600
                    (font-bold→font-semibold), palier haut retenu pour Anonymous Pro 14px. */}
                <p className="text-sm text-muted-foreground">
                  Donnez des cours de musique et de loisirs près de chez vous — <span className="font-semibold"><span className="font-mono">{formatPourcent(0)}</span></span> de commission.
                </p>
                {/* Complément dispatcher (passage 33) : /gains a 0 lien entrant depuis ce profil.
                    B39-10 (passage 39) : `.link-action` — la terre (registre "prof") n'est plus
                    une couleur de lien, seulement un accent décoratif. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <a href="/devenir-prof" className="link-action inline-flex min-h-11 items-center text-sm font-medium">
                    Devenir prof
                  </a>
                  <a href="/gains" className="link-action inline-flex min-h-11 items-center text-sm font-medium">
                    Mes gains
                  </a>
                </div>
              </>
            )}
          </Card>

          {/* B43-8 (passage 43) : 3e rangée réelle pour absorber le vide de pied de page (217,8px
              mesuré à 1440, 245px à 768 — `main` `flex-1` du layout racine impose un plancher de
              hauteur indépendant du contenu, cf. B32-5/B41-9 : la seule façon de le résorber sans
              toucher au layout partagé par toute l'app est d'ajouter du contenu réel qui occupe
              cet espace, exactement le patron déjà posé sur `/wallet` ("Comment se remplit KOSHA")
              et `/gains` ("Ce que vous gagneriez") au passage 41). Les dernières entrées réelles
              de la timeline du cours en cours (pas seulement leur compte, déjà affiché dans « Vos
              cours » ci-dessus) — sauté silencieusement si aucun cours en cours n'a d'entrée,
              jamais un bloc vide inventé. */}
          {dernieresEntrees.length > 0 && prochaineCours && (
            <Card className="border border-border p-6 md:col-span-2">
              <CardTitle>Dernières entrées de la timeline</CardTitle>
              <div className="mt-3 space-y-2">
                {dernieresEntrees.map((entree) => (
                  <div
                    key={entree.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <span className="flex min-w-0 items-center gap-3 text-sm font-medium">
                      {prochaineCoursProf ? <AvatarInitiale prenom={prochaineCoursProf} size={24} /> : null}
                      <span className="truncate">
                        {TYPE_ENTREE_LABELS[entree.type] ?? 'Entrée'}
                        {prochaineCoursProf ? ` · ${prochaineCoursProf}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-medium text-muted-foreground">
                      {new Date(entree.survenu_le).toLocaleString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href={`/cours/${prochaineCours.id}/timeline`}
                className="link-action mt-3 inline-flex min-h-11 items-center text-sm font-medium"
              >
                Voir toute la timeline
              </a>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
