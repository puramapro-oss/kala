'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useTimelineCours } from '@/hooks/useTimelineCours';
import { createClient } from '@/lib/supabase';
import type { Database } from '@/types/database';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import CardIcon from '@/components/ui/CardIcon';
import CardTitle from '@/components/ui/CardTitle';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Badge from '@/components/ui/Badge';
import AvatarInitiale from '@/components/ui/AvatarInitiale';
import AjouterPhoto from '@/components/timeline/AjouterPhoto';
import AjouterNote from '@/components/timeline/AjouterNote';
import IconeNote from '@/components/icons/IconeNote';
import IconePhoto from '@/components/icons/IconePhoto';
import FormeOnde from '@/components/brand/FormeOnde';
import { ClipboardList } from 'lucide-react';
import { formatPlageLongue, formatPlageCompacte } from '@/lib/format';

type Reservation = Database['purama_marketplace']['Tables']['reservations']['Row'];
// Table partagée purama_marketplace.journal_garde (schéma marketplace commun, nom immuable)
type EntreeTimeline = Database['purama_marketplace']['Tables']['journal_garde']['Row'];

// Icône par type d'entrée (B30-2) — colonne d'icônes en text-secondary-on-dark, jamais d'émoji.
// KALA : photo et note uniquement (pas de suivi GPS ni de repas).
const ICONE_PAR_TYPE: Record<string, ReactNode> = {
  photo: <IconePhoto className="w-6 h-6" />,
  note: <IconeNote className="w-6 h-6" />,
};

// B41-4 (passage 41) : un jour civil par ligne entre `debut_le` et `fin_le` RÉELS de la
// réservation — pour la mini-frise "Résumé du cours" de l'aside desktop, jamais une plage
// inventée. `dernier` inclus (cours d'1 seul jour → 1 ligne, pas 0).
function joursDuCours(debut: string, fin: string): Date[] {
  const jours: Date[] = [];
  const curseur = new Date(debut);
  curseur.setHours(0, 0, 0, 0);
  const dernier = new Date(fin);
  dernier.setHours(0, 0, 0, 0);
  while (curseur <= dernier) {
    jours.push(new Date(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }
  return jours;
}

function memeJourCivil(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function TimelineCoursPage() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;
  const supabase = createClient();

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProf, setIsProf] = useState(false);
  const [modalType, setModalType] = useState<'photo' | 'note' | null>(null);

  // B30-17 : prénom réel du prof pour un en-tête nommé (« Cours avec Marie »), plutôt que le
  // générique « Timeline du cours » du passage 29.
  const [profNom, setProfNom] = useState<string | null>(null);

  const { entries, loading: loadingTimeline, error: errorTimeline, addEntry } = useTimelineCours(reservationId);

  useEffect(() => {
    const loadReservation = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login?next=' + encodeURIComponent('/cours/' + reservationId + '/timeline'));
          return;
        }

        // Récupérer le profil de l'utilisateur connecté
        const { data: profil } = await supabase
          .from('profils')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!profil) {
          setError('Profil introuvable');
          setLoading(false);
          return;
        }

        // Récupérer la réservation avec les infos du prestataire
        const { data: resaData, error: resaError } = await supabase
          .from('reservations')
          .select(`
            *,
            prestataires:prestataire_id (
              profil_id
            )
          `)
          .eq('id', reservationId)
          .single();

        if (resaError || !resaData) {
          setError('Réservation introuvable');
          setLoading(false);
          return;
        }

        const resaTyped = resaData as Reservation & {
          prestataires?: { profil_id: string };
        };

        setReservation(resaTyped);

        // Déterminer si l'utilisateur est le prof ou l'élève
        const profProfilId = resaTyped.prestataires?.profil_id;
        const clientProfilId = resaTyped.client_profil_id;

        if (profil.id !== profProfilId && profil.id !== clientProfilId) {
          // EX-057 : RLS devrait bloquer en amont, mais doublon défense en profondeur
          setError('Vous n\'avez pas accès à cette timeline');
          setLoading(false);
          return;
        }

        setIsProf(profil.id === profProfilId);

        // B30-17 : prénom du prof — via `/api/enregistrements` (service_role, même contrôle
        // d'appartenance qu'au-dessus), PAS une requête directe côté navigateur : la policy RLS
        // `profils` ne laisse un utilisateur lire que SA PROPRE ligne, jamais celle d'un autre
        // participant à la réservation (mesuré : la requête directe sur le profil du prof ne
        // renvoyait rien pour l'élève, et réciproquement).
        try {
          const res = await fetch(`/api/enregistrements?reservation_id=${reservationId}`);
          if (res.ok) {
            const contexte = await res.json() as { profNom: string | null };
            setProfNom(contexte.profNom);
          }
        } catch {
          // Best-effort : un échec ici ne doit jamais bloquer l'affichage de la timeline
          // elle-même, seul l'en-tête nommé retombe sur son repli générique.
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        setLoading(false);
      }
    };

    loadReservation();
  }, [reservationId, router, supabase]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="max-w-4xl">
          <Card className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-laiton/20 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-laiton/20 rounded w-2/3"></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="max-w-4xl">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  if (!reservation) {
    return null;
  }

  const { statut, debut_le, fin_le } = reservation;

  // EX-051 : accessible uniquement si statut en_cours ou terminee
  if (statut !== 'en_cours' && statut !== 'terminee') {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="max-w-4xl">
          <Card className="p-6">
            <p className="text-portee/60">
              La timeline sera accessible dès le début du cours.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // B40-3 (passage 40, MAJEUR) : les 2 blocs latéraux (identité, résumé) sont extraits en
  // variables JSX — un seul markup, rendu à DEUX emplacements (avant/après la timeline sous `xl`,
  // colonne collante à partir de `xl`), jamais deux versions écrites à la main qui peuvent diverger
  // (même principe que `AvisCards` sur `/prof/[id]`, B30-19). Sous `xl`, l'ordre de lecture
  // devient identité → entrées → résumé (recette DA : le cours en cours d'abord, la timeline
  // ensuite, le résumé en dernier) au lieu de « toute la colonne latérale avant tout ».
  const identiteCard = (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pl-20 space-y-3">
      <CardIcon>
        {/* AvatarInitiale (B41-11) : réutilise le composant partagé plutôt qu'un monogramme
            manuscrit — initiale du prénom du prof, même repli que partout ailleurs. */}
        <AvatarInitiale prenom={profNom || 'Prof'} size={40} />
      </CardIcon>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold text-foreground truncate">
          Cours avec {profNom || 'votre prof'}
        </h3>
        <p className="text-sm text-portee/60 truncate">Suivi partagé du cours</p>
      </div>
      {/* S42-e : plage de dates = donnée secondaire → font-medium (500). */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-portee/60">
        <span className="font-mono font-medium">{formatPlageCompacte(debut_le, fin_le)}</span>
        <Badge variant={statut === 'en_cours' ? 'success' : 'default'}>
          {statut === 'en_cours' ? 'En cours' : 'Terminée'}
        </Badge>
      </div>
    </div>
  );

  // B41-4 (passage 41) : mini-frise "Résumé du cours" — un jour civil par ligne (plage réelle
  // `debut_le`→`fin_le`), nombre d'entrées de ce jour agrégé depuis `entries` déjà chargé (aucune
  // donnée inventée). Aside desktop sticky (`xl:sticky xl:top-24 xl:self-start`, plus bas) déjà
  // posé correctement — le vide mesuré par le DA à scroll=0 est structurel (capture pleine page),
  // ce contenu réduit le delta réel malgré tout plutôt que de compter uniquement sur le sticky au
  // scroll.
  const joursCours = joursDuCours(debut_le, fin_le).map((jour) => ({
    jour,
    nombre: entries.filter((e) => memeJourCivil(new Date(e.survenu_le), jour)).length,
  }));

  // B41-5 (passage 41) : cette carte n'a pas de `<CardIcon>` — `pl-20` (retrait réservé à la
  // boîte icône 40×40, B40-1) laissait donc 80px vides devant "Résumé" sans rien à cet endroit.
  // Padding standard `p-6` d'une carte sans icône (même patron que la carte "Actions prof").
  // B42-2/B43-2 (passage 42 puis 43, MÊME ERREUR RÉGRESSÉE) : le passage 42 avait dit avoir fermé
  // cet écart en fusionnant ce correctif avec B41-11 (vignette de la carte prof voisine) — mais
  // donner une icône à la carte d'identité (qui en avait déjà une) ne donne aucune icône à
  // CETTE carte. Le DA du passage 43 a mesuré l'écart de 56px inchangé aux 3 viewports : la
  // documentation affirmait un fix qui n'avait jamais été appliqué au bon fichier/à la bonne
  // carte. `<CardIcon>` + `pl-20` réellement posés ici cette fois, vérifiés par mesure DOM avant
  // de documenter quoi que ce soit.
  const resumeCard =
    !loadingTimeline && entries.length > 0 ? (
      <div className="relative overflow-hidden rounded-lg border border-border bg-card p-6 pl-20">
        <CardIcon>
          <ClipboardList aria-hidden="true" className="h-5 w-5 shrink-0 text-secondary-on-dark" />
        </CardIcon>
        <CardTitle tag="h3">Résumé</CardTitle>
        {/* B41-10 (passage 41) : 18px hors échelle Anonymous Pro à 3 paliers (12/14/20) — ce
            chiffre joue un rôle de stat mise en avant dans la carte, ramené au palier le plus
            grand (20px) plutôt que compressé au palier body. */}
        <p className="font-mono text-xl font-semibold text-foreground">
          {entries.length} {entries.length > 1 ? 'entrées' : 'entrée'}
        </p>
        <p className="mt-1 text-sm text-portee/60">
          Dernière activité :{' '}
          {new Date(entries[entries.length - 1].survenu_le).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-portee/50">
            Résumé du cours
          </p>
          <ul className="space-y-1">
            {joursCours.map(({ jour, nombre }) => (
              <li
                key={jour.toISOString()}
                className="flex items-center justify-between text-sm text-portee/60"
              >
                <span>{jour.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                {/* S42-e : compteur d'entrées par jour = donnée secondaire → font-medium (500). */}
                <span className="font-mono font-medium text-portee/80">
                  {nombre} {nombre > 1 ? 'entrées' : 'entrée'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    ) : null;

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 pb-24">
      {/* xl:max-w-none (B31-6) : le rail reste 896 px sous xl (inchangé), mais à partir de xl la
          colonne vertébrale a besoin de toute la largeur du conteneur pour poser la carte
          d'identité en sidebar sans déborder — sinon 896 (gauche) + 32 (gap) + 360 (droite) =
          1288 px dans un conteneur de 1232 px utiles. */}
      <div className="max-w-4xl xl:max-w-none">
        {/* S41-c (passage 41) : chevron retour mobile — le bouton retour global de `Header.tsx`
            ne couvre que certains pathnames (2 niveaux de profondeur ici : dashboard → cours →
            timeline, hors périmètre de ce fichier pour étendre Header). Réplique locale du même
            patron visuel (chevron 24px, cible tactile ≥44px, aria-label "Retour", `md:hidden` —
            mêmes conditions que le bouton global). Destination la plus logique avec les données
            disponibles : `/dashboard`. */}
        <Link
          href="/dashboard"
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground md:hidden"
          aria-label="Retour au tableau de bord"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </Link>

        {/* En-tête (B30-4 : rail commun ancré à gauche ; B30-17 : nommé) */}
        <div className="mb-6">
          {/* B35-12 (passage 35/36, MINEUR) : le palier 30px portait 2 graisses — 600 ici contre
              700 sur /wallet, /gains, /devenir-prof pour le même rôle (titre de page).
              Uniformisé sur 700. */}
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            {profNom ? `Cours avec ${profNom}` : 'Timeline du cours'}
          </h1>
          {/* B34-6 (passage 34) : plage longue unifiée — remplace les 2 spans « Du »/« Au »
              séparés par un `·` (3e format de date du produit, désormais réduit à 2). */}
          <div className="flex items-center gap-3 text-sm text-portee/60">
            <span>{formatPlageLongue(debut_le, fin_le)}</span>
            <Badge variant={statut === 'en_cours' ? 'success' : 'default'}>
              {statut === 'en_cours' ? 'En cours' : 'Terminée'}
            </Badge>
          </div>
        </div>

        {/* B31-6 : deux colonnes à partir de xl (entrées à gauche, carte d'identité collante à
            droite).
            B40-3 (passage 40, MAJEUR, corrige la régression B37-11) : `order` (posé au passage 37)
            réordonnait bien VISUELLEMENT la colonne latérale entière au-dessus du fil sous xl, mais
            faisait passer identité ET résumé avant les entrées — le DA veut une lecture
            « identité du cours → entrées → résumé », pas « toute la colonne latérale avant tout ».
            `order` sur un bloc unique ne peut pas scinder son contenu : les 2 cartes
            (`identiteCard`/`resumeCard`, extraites ci-dessus) sont donc rendues à DEUX
            emplacements distincts — un jeu `xl:hidden` avant/après le fil (ordre de lecture mobile
            correct, dans le DOM réel, plus besoin de `order`) et un 2e jeu `hidden xl:block`
            inchangé dans la colonne collante (comportement desktop identique à avant, le DA l'a
            qualifié de correct). Même principe que `AvisCards` sur `/prof/[id]` (B30-19). */}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr,360px] xl:items-start">
          {/* Identité — mobile/tablette uniquement, AVANT le fil (B40-3). */}
          <div className="xl:hidden">{identiteCard}</div>

          <div className="min-w-0">
            {/* Actions prof */}
            {isProf && statut === 'en_cours' && (
              <Card className="p-6 mb-6 bg-laiton/10 border-laiton/20">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setModalType('photo')}
                  >
                    <IconePhoto className="w-4 h-4 mr-1.5 text-secondary-on-dark" />
                    Photo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setModalType('note')}
                  >
                    <IconeNote className="w-4 h-4 mr-1.5 text-secondary-on-dark" />
                    Note
                  </Button>
                </div>
              </Card>
            )}

            {/* Flux de la timeline */}
            {loadingTimeline && (
              <Card className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-laiton/20 rounded w-3/4"></div>
                  <div className="h-4 bg-laiton/20 rounded w-1/2"></div>
                </div>
              </Card>
            )}

            {errorTimeline && <ErrorState message={errorTimeline} />}

            {!loadingTimeline && !errorTimeline && entries.length === 0 && (
              // EX-060 : état vide = invitation à agir
              <EmptyState
                icon={<IconeNote className="w-10 h-10" />}
                title="Aucune entrée pour le moment"
                description={
                  isProf
                    ? 'Commencez à documenter le cours en ajoutant une photo ou une note.'
                    : 'Le prof pourra partager des photos et des mises à jour pendant le cours.'
                }
              />
            )}

            {!loadingTimeline && entries.length > 0 && (
              // §E-2 (passage 30) : colonne vertébrale — filet vertical 1 px derrière une
              // pastille forme d'onde par entrée, la pile de cartes devient une TRACE
              // chronologique.
              <div className="relative">
                {/* B39-1/B39-12 (passage 39, MINEUR) : marqueur à `left-[11px]` (10px) + contenu à
                    `pl-10` (40px) donnait une gouttière de 80px — bien au-delà de tout ce qui reste
                    de la carte. Formule B39-1 appliquée : rail du marqueur à `left-6` (24px),
                    contenu à `24+10+16=50px`. Le filet de colonne (spine) recalé sur le centre du
                    nouveau marqueur (24+5=29px) pour continuer à passer derrière les pastilles.
                    B40-3 (passage 40, MOYEN) : sous `lg`, ce rail décalait TOUTES les cartes
                    d'entrée de 50px (left=74/width=277) par rapport aux autres cartes de la page
                    (left=24/width=327, mesuré par le DA) — la piste manque de largeur pour porter
                    un rail décoratif en dessous de `lg`. `hidden lg:block` sur le filet et le
                    marqueur, `pl-0 lg:pl-[50px]` sur chaque entrée : le rail n'existe visuellement
                    qu'à partir de `lg`, où la colonne est assez large pour l'accueillir sans
                    rétrécir les cartes. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[29px] top-3 bottom-3 hidden w-px lg:block"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                />
                <div className="space-y-4">
                  {entries.map((entry: EntreeTimeline) => (
                    <div key={entry.id} className="relative pl-0 lg:pl-[50px]">
                      <span className="absolute left-6 top-6 hidden h-2.5 w-2.5 items-center justify-center lg:flex">
                        <FormeOnde className="h-2.5 w-2.5 text-secondary-on-dark" />
                      </span>
                      <EntreeTimelineCard entry={entry} auteurPrenom={profNom} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Résumé — mobile/tablette uniquement, APRÈS le fil (B40-3). */}
          <div className="xl:hidden space-y-4">
            {resumeCard}
          </div>

          {/* Colonne latérale desktop — cachée sous xl (B40-3, remplacée par les 2 blocs
              `xl:hidden` ci-dessus en dessous de xl), inchangée à xl+ : identité, résumé
              collants (B31-6, B35-4). */}
          <div className="hidden space-y-4 xl:block xl:sticky xl:top-24 xl:self-start">
            {identiteCard}
            {resumeCard}
          </div>
        </div>

        {/* Modals ajout */}
        {modalType === 'photo' && (
          <div className="fixed inset-0 bg-pupitre/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full">
              <AjouterPhoto
                onPhotoAjoutee={async (photoUrl, note) => {
                  const success = await addEntry({
                    typeEntree: 'photo',
                    photoUrl,
                    contenuTexte: note,
                  });
                  if (success) {
                    setModalType(null);
                  }
                }}
                onAnnuler={() => setModalType(null)}
              />
            </div>
          </div>
        )}

        {modalType === 'note' && (
          <div className="fixed inset-0 bg-pupitre/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="max-w-lg w-full">
              <AjouterNote
                onNoteAjoutee={async (texte) => {
                  const success = await addEntry({
                    typeEntree: 'note',
                    contenuTexte: texte,
                  });
                  if (success) {
                    setModalType(null);
                  }
                }}
                onAnnuler={() => setModalType(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Composant carte d'entrée de la timeline
function EntreeTimelineCard({ entry, auteurPrenom }: { entry: EntreeTimeline; auteurPrenom: string | null }) {
  // B4/schéma réel vs colonnes fantômes (passage 29) : purama_marketplace.journal_garde
  // expose `type`, `message`, `photo_path`, `trace_points`, `distance_m`, `duree_s`, `survenu_le`
  // (pas type_entree/contenu_texte/photo_url/trace_gps/distance_km/duree_minutes/horodatage).
  // KALA : photo et note uniquement — les colonnes GPS ne sont plus alimentées par cette app.
  const { type, survenu_le, message, photo_path } = entry;

  // EX-059 : affichage heure locale FR (PIEGES §9 — jamais toISOString brut)
  const dateLocale = new Date(survenu_le);
  const heureLocale = dateLocale.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  // `type` suit l'ENUM DB à 4 valeurs (photo|promenade|repas|note) partagé avec les autres
  // apps marketplace — KALA n'alimente que photo/note, les 2 autres retombent sur le fallback.
  const TITRE_PAR_TYPE: Record<string, string> = {
    photo: 'Photo',
    note: 'Note',
  };
  const titre = TITRE_PAR_TYPE[type] ?? 'Entrée';

  // Photos de démo servies en local (/public/journal-demo/) ou URL absolue
  const photoAffichable = photo_path && (photo_path.startsWith('/') || photo_path.startsWith('http'));

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <span className="text-secondary-on-dark shrink-0">
          {ICONE_PAR_TYPE[type] ?? <IconeNote className="w-6 h-6" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2">
            {/* B35-12 (MINEUR) : palier 16px imposé à leading-6 (24px) partout — ce titre d'entrée
                (rôle distinct du "titre de carte latérale", reste à 16px — décision documentée, un
                item de liste répété n'a pas la même charge visuelle qu'un titre de section) portait
                19,2px hérité de la règle globale h1-h6 line-height:1.2.
                B39-6 (passage 39) : couleur seule alignée sur `--foreground` (portée héritée depuis
                comme couleur de titre, recette DA) — la taille 16px reste volontairement distincte
                du composant `CardTitle` (18px), rôle différent assumé. */}
            <h4 className="font-semibold text-foreground leading-6">{titre}</h4>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-portee/60">{heureLocale}</span>
              {auteurPrenom && <AvatarInitiale prenom={auteurPrenom} size={24} />}
            </div>
          </div>

          {message && (
            <p className="text-sm text-portee/80 mb-2">{message}</p>
          )}

          {photoAffichable && (
            // B39-8 (passage 39, MOYEN) : mesurée à 1430×950px par le DA sur /timeline@1440 — le
            // plus grand objet de la page alors que son sujet est le texte du prof.
            // `object-cover` (déjà en place sur l'`<img>`) recadre sans déformer.
            // B40-8 (passage 40) : `max-h-[420px]` combiné à `aspect-[16/10]` donnait à 1440 une
            // boîte 704×420 (ratio 1,676) pour un ratio naturel de 1,600 → 4,5% de rognage vertical
            // (ombre du panier + empreintes basses amputées). Plafond posé sur la LARGEUR au lieu de
            // la hauteur : `max-w-[672px]` (672/1,6=420 exactement) plafonne la hauteur à 420px SANS
            // jamais rogner, quelle que soit la largeur de colonne disponible.
            <div className="mb-2 w-full max-w-[672px] overflow-hidden rounded-2xl aspect-[16/10]">
              <img
                src={photo_path}
                alt={message || `${titre} du cours`}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
