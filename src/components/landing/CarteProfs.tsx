'use client';

/**
 * CarteProfs — Liste des 5 profs vérifiés les plus proches, SANS mur d'auth (EX-001).
 * Affiche EX-002 : photo, prénom, note moyenne ou "Nouveau", distance, tarif à partir de, types de cours.
 * Gère EX-003 : géoloc navigateur → fallback code postal.
 * EX-004 : état vide honnête (aucun prof fictif en prod).
 */

import { useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import FormeOnde from '@/components/brand/FormeOnde';
import AvatarInitiale from '@/components/ui/AvatarInitiale';
import NoteProf from '@/components/ui/NoteProf';
import { formatDistance, formatPourcent } from '@/lib/format';

export interface Prof {
  id: string;
  photo_url: string | null;
  prenom: string;
  note_moyenne: number | null;
  distance_km: number;
  tarif_minimum_cents: number | null;
  types_garde: string[];
  commune: string;
  karma_score: number;
}

interface CarteProfsProps {
  coords?: { lat: number; lon: number } | null;
  // B23-1 : coords issues d'un code postal hors zone (mapping mockGeocode) retombent sur Frasne
  // sans le dire — une distance affichée serait alors fausse (Marie "à 3,2 km" d'un visiteur situé
  // en réalité à 430km). true masque la portion distance de chaque tuile.
  distancesUnreliable?: boolean;
  // B23-6 : liste rendue côté serveur (src/app/page.tsx) pour que le premier HTML envoyé contienne
  // déjà les profs — sans ça, un crawler, un aperçu de lien ou un visiteur dont le chunk JS
  // n'arrive pas ne voit jamais que 5 rectangles gris.
  initialProfs?: Prof[];
}

export default function CarteProfs({ coords, distancesUnreliable, initialProfs }: CarteProfsProps) {
  const [profs, setProfs] = useState<Prof[]>(initialProfs || []);
  const [loading, setLoading] = useState(!initialProfs);
  const [error, setError] = useState<string | null>(null);
  // B23-6 : la toute première exécution de l'effet ne doit PAS relancer un fetch identique à celui
  // déjà fait côté serveur — seulement si initialProfs a été fourni ET que coords est toujours
  // null (aucune géoloc/recherche n'a encore changé la requête). Tout changement ultérieur de
  // `coords` (géoloc résolue, code postal soumis) doit re-fetcher normalement.
  const skipFirstFetch = useRef(!!initialProfs);

  useEffect(() => {
    if (skipFirstFetch.current && !coords) {
      skipFirstFetch.current = false;
      return;
    }
    skipFirstFetch.current = false;

    // B19-4 : sans AbortController, un rechargement où la requête sans coords (montage) répond
    // APRÈS celle avec coords (arrivée géoloc) écrasait la liste correcte par un résultat obsolète
    // (profs "à proximité" affichés à un visiteur hors rayon, 3 fois sur 8 mesurées).
    const controller = new AbortController();
    // B21-2 : sans borne de temps, un réseau qui ne répond pas laissait les squelettes pulser à
    // l'infini (mesuré 20 `animate-pulse` encore actifs à 13s) — CLAUDE.md §13 erreur n°10 impose
    // un repli à 10s. `timedOut` distingue un abandon volontaire (démontage, `coords` qui change)
    // d'un vrai dépassement de délai : les deux déclenchent un AbortError identique, seul le
    // second doit afficher un message et sortir du skeleton.
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10000);

    async function fetchProfs() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (coords) {
        params.set('lat', String(coords.lat));
        params.set('lon', String(coords.lon));
      }
      params.set('rayon', '25');
      params.set('limit', '5');

      try {
        const res = await fetch(`/api/profs?${params}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error('Impossible de charger les profs.');
        }
        const data = await res.json();
        setProfs(data.profs || []);
        setLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          if (timedOut) {
            setError("Impossible de joindre nos profs pour l'instant. Vérifiez votre connexion.");
            setLoading(false);
          }
          return;
        }
        console.error(err);
        setError('Une erreur est survenue lors du chargement des profs.');
        setLoading(false);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    fetchProfs();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [coords]);

  // role="status" aria-live="polite" (B22-6) : un seul conteneur, JAMAIS démonté, qui traverse les
  // 4 états (chargement/erreur/vide/liste) — sans lui, le message d'erreur écrit pour B21-2 et le
  // remplacement des squelettes par la liste passent en silence pour un lecteur d'écran (WCAG 4.1.3).
  if (loading) {
    return (
      <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-16 w-16 rounded-full mb-3" />
            <Skeleton className="h-5 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="status" aria-live="polite">
        <ErrorState message={error} retry={() => window.location.reload()} />
      </div>
    );
  }

  if (profs.length === 0) {
    // EX-004 : état vide honnête + CTA devenir prof
    return (
      <div role="status" aria-live="polite">
        <EmptyState
          title="Aucun prof dans votre rayon"
          description="Aucun prof vérifié n'est disponible actuellement. Vous êtes passionné de musique ou de loisirs ?"
          action={{ label: 'Devenir prof', href: '/devenir-prof' }}
        />
      </div>
    );
  }

  // Compte tuiles réelles (profs + carte invitation si <3)
  const hasInvitation = profs.length < 3;
  const totalTiles = hasInvitation ? profs.length + 1 : profs.length;
  const gridCols = totalTiles === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : totalTiles < 3 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3';

  return (
    <div role="status" aria-live="polite" className={`grid grid-cols-1 gap-4 ${gridCols}`}>
      {/* min-w-0 sur le <a>/Card (B20-1) : sans lui, un enfant grid garde min-width:auto (= son
          min-content) et peut forcer la piste plus large que le conteneur sous police agrandie —
          rogné en silence par l'overflow-hidden de Card plutôt que de simplement passer à la ligne.
          animate-card-enter + animationDelay (B25-14) : cascade promise par DESIGN-PLAN.md
          (stagger 60ms, scale 0,8→1) jamais implémentée — `document.getAnimations()` renvoyait 0 au
          chargement. Neutralisée sous prefers-reduced-motion et à l'impression (globals.css). */}
      {/* B38-1/B38-3/B38-4b (passage 38) : l'ancienne ligne icône+titre (`flex items-start gap-3`)
          plaçait le titre 60px plus loin que le bloc infos (note/distance/tarif) juste en-dessous —
          un « escalier » dans la même carte. Recette PASSAGE 38 (adaptée ici à un avatar 48px au
          lieu de 40px : `pl-[88px]` = `left-6` (24px) + largeur avatar (48px), flush comme sur
          les cartes de référence) : la CARTE ENTIÈRE devient `relative`, un seul padding-gauche pour
          tout le contenu texte, l'avatar sort du flux (`absolute left-6 top-4`, indépendant de tout
          texte voisin, `left-6` garantit x(icône) ≥ x(carte)+20). Titre et corps héritent alors du
          même `pl-[88px]` → même x, à 1px près, aux 3 largeurs.
          `rounded-lg` posé sur l'`<a>` focusable lui-même (B38-4b) : sans lui l'anneau de focus
          hérite d'un `border-radius:0` par défaut alors que la `<Card>` enfant est arrondie à 24px
          (`--radius-lg`) — au clavier, les 4 coins du liseré dépassaient des coins arrondis. */}
      {profs.map((p, i) => (
        <a key={p.id} href={`/prof/${p.id}`} className="h-full min-w-0 rounded-lg animate-card-enter" style={{ animationDelay: `${i * 60}ms` }}>
          <Card className="relative h-full min-w-0 p-4 pl-[88px] hover:scale-[1.02] transition-transform cursor-pointer">
            <div className="absolute left-6 top-4 w-12 h-12">
              <AvatarInitiale prenom={p.prenom} photoUrl={p.photo_url} size={48} />
            </div>
            <div className="mb-3">
              {/* B39-12 (passage 39, MINEUR) : `h3` sans marge basse propre + `line-height` serré
                  faisait toucher prénom et commune (0px d'écart mesuré) — `mb-0.5` sépare les 2
                  lignes sans les décoller du couple visuel qu'elles forment. */}
              <h3 className="mb-0.5 font-display text-lg font-semibold text-foreground">{p.prenom}</h3>
              <p className="font-body text-sm text-foreground-muted">{p.commune}</p>
            </div>

            <div className="space-y-2 text-sm font-body text-foreground-muted">
              <div className="flex items-center gap-2">
                {p.note_moyenne !== null ? (
                  <NoteProf note={p.note_moyenne.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
                ) : (
                  <span className="text-foreground font-semibold">Nouveau</span>
                )}
                {/* B23-1 : distance masquée quand elle repose sur un repli Frasne non représentatif —
                    une distance fausse est pire qu'une distance absente. */}
                {!distancesUnreliable && (
                  <>
                    <span>·</span>
                    {/* font-mono (B24-7) : la distance était en Inter alors que le DESIGN-PLAN
                        l'assigne explicitement à la police utilitaire, au même titre que les tarifs. */}
                    {/* formatDistance seul (B30-15, passage 30) : deux formats sur la même ligne du
                        même composant. Le formateur rend désormais toujours des km. */}
                    {/* S42-e : distance = donnée secondaire → font-medium (500), pas la graisse
                        par défaut (400). */}
                    <span className="font-mono font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatDistance(p.distance_km)}
                    </span>
                  </>
                )}
              </div>

              {/* font-mono (B24-7) : le DESIGN-PLAN assigne IBM Plex Mono aux « chiffres de tarifs,
                  horaires, distances » — le prix rendait en Inter (font-body), seule la distance
                  ci-dessus était déjà en mono avant ce correctif. */}
              {p.tarif_minimum_cents !== null && (
                <p className="text-foreground">
                  À partir de <span className="font-semibold font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{(p.tarif_minimum_cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </p>
              )}

              {p.types_garde.length > 0 && (
                <p className="text-xs">
                  {p.types_garde.map((t) => {
                    // KALA : seuls 'domicile' et 'visite' existent côté cours (libellés raccourcis tuile)
                    const labels: Record<string, string> = { domicile: 'À domicile', visite: 'Chez le prof' };
                    return labels[t] || t;
                  }).join(' · ')}
                </p>
              )}
            </div>
          </Card>
        </a>
      ))}

      {/* min-w-0 sur le <a> grid item et le conteneur flex-1 (B20-1) : même piège que les tuiles
          profs ci-dessus — sans lui, une piste de grille peut être forcée plus large que le
          conteneur par du contenu qui refuse de rétrécir sous police agrandie. */}
      {/* group (B24-8) : le survol de la tuile entière doit aussi être visible sur le libellé
          "Créer mon profil prof →" lui-même — `transform` n'est pas une propriété héritée, le
          `scale` posé sur `<Card>` ne changeait donc rien au `getComputedStyle` de ce `<p>` propre. */}
      {/* animate-card-enter (B26-12, passage 26) : B25-14 avait posé l'animation d'entrée sur les
          cartes prof mais s'était arrêté là — cette tuile, 3e élément de la même grille, apparaissait
          sèchement pendant que ses 2 voisines montaient. Délai `profs.length * 60ms` : elle continue
          la même cascade, pas une cascade séparée. */}
      {profs.length < 3 && (
        <a
          href="/devenir-prof"
          className="group h-full min-w-0 rounded-lg md:col-span-2 lg:col-span-1 animate-card-enter"
          style={{ animationDelay: `${profs.length * 60}ms` }}
        >
          {/* border-secondary-on-dark/40 (B24-3) : terre = côté prof de la place de marché
              (gagner, être vérifié, être noté) — mousse reste réservée au côté élève
              (chercher, réserver, payer). Cette tuile est la seule action côté prof de la home. */}
          {/* <div> nu, pas <Card> (B28-12 retourné, passage 29) : `.glass` (Card.tsx) pose un
              SHORTHAND `border: 1px solid var(--glass-border)` — la couleur `border-secondary-on-dark/40`
              passée en className perdait la cascade (chrome strictement identique aux cartes prof,
              la « bordure dédiée » n'existait pas à l'écran). Objet délibérément distinct, construit
              sans `.glass` : fond teinté terre + bordure terre posés directement, aucune cascade
              à gagner. */}
          {/* B38-3 (passage 38) : 3 rails différents dans la même carte. Même recette que les
              cartes prof ci-dessus : conteneur `relative pl-[88px]`, icône `absolute left-6 top-4`,
              titre + badge + paragraphe tous en flux normal (aucun n'a plus sa propre indentation
              locale) → même x pour les 3, à 1px près. */}
          <div className="relative h-full min-w-0 p-4 pl-[88px] rounded-lg overflow-hidden bg-secondary/10 border border-secondary-on-dark/40 hover:scale-[1.02] transition-transform cursor-pointer">
            <div className="absolute left-6 top-4 w-12 h-12 flex items-center justify-center rounded-full bg-secondary/20 ring-1 ring-secondary-on-dark">
              <FormeOnde className="w-6 h-6 text-secondary-on-dark" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">Devenir prof</h3>
            <div className="mt-1 mb-3 inline-flex min-w-0 max-w-full items-center gap-2 px-3 py-1 rounded-pill bg-secondary/20 border border-secondary-on-dark">
              {/* formatPourcent (B31-8) : même règle unique que Footer.tsx/HomeClient.tsx —
                  fine insécable U+202F réelle avant %, IBM Plex Mono. */}
              {/* S42-e : "0%" (IBM Plex Mono) est une valeur mise en avant → 600 posé directement sur
                  le span mono (override de l'héritage 700 du badge, sans toucher la graisse Inter de
                  "de commission" qui partage le même span parent — hors périmètre S42-e). */}
              <span className="min-w-0 text-sm font-bold text-foreground"><span className="whitespace-nowrap"><span className="font-mono font-semibold">{formatPourcent(0)}</span></span> de commission</span>
            </div>
            <p className="text-sm text-secondary-on-dark font-medium group-hover:underline">
              Créer mon profil prof →
            </p>
          </div>
        </a>
      )}
    </div>
  );
}
