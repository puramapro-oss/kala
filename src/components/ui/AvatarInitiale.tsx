'use client';

/**
 * AvatarInitiale — composant unifié pour afficher photo ou initiale dans un cercle (B13-6).
 * Cercle bordé terre (identité "côté prof", B24-3/B24-5) avec initiale en police display/serif.
 * Utilisé dans CarteProfs + fiche prof pour cohérence visuelle.
 * B24-3/B24-5 (passage 24) : anneau passé de laiton (primary-on-dark, réservé au côté élève)
 * à terre (secondary-on-dark, côté prof) — l'avatar EST un prof, la couleur doit le dire ; au
 * passage, le recensement DA notait `--secondary` à 0 pixel sur les 2 écrans principaux du produit.
 * B41-10 (passage 41, DA contexte vierge) : l'initiale empruntait Syne (`font-display`) à une
 * taille CONTINUE (`size * 0.5`, calc()), produisant 7 corps différents selon la page (10 à 60px) —
 * la même famille display que les H1 n'a pas de raison de porter une lettre isolée dans un cercle.
 * Fixe alors : Anonymous Pro 600 (`font-mono font-semibold`), à SEULEMENT 3 paliers discrets
 * mappés sur les 3 diamètres réels d'avatar de l'app (24→12px, 32→14px, 48→20px).
 * B43 (passage 43, audit remplissage) : ce plafond à 3 paliers avait un effet de bord non anticipé
 * — tout diamètre hors des 3 valeurs de référence (40, 64, ou le `clamp(72px,25vw,120px)` de
 * l'avatar héros /prof/[id]) retombait au palier le PLUS PROCHE, donc au mieux 20px de lettre
 * dans un cercle de 120px : remplissage mesuré à 2,1% (contre 18,8% pour l'avatar 24px le mieux
 * loti). Compromis retenu, documenté ici plutôt que de rouvrir B41-10 en boucle : le RATIO
 * police/diamètre reste une constante unique et disciplinée, mais la police est calculée EN CONTINU
 * depuis le diamètre réel (`style` inline) plutôt que via un palier Tailwind discret. La famille et
 * la graisse (Anonymous Pro 600) ne changent toujours pas d'une page à l'autre — seule la TAILLE
 * suit maintenant fidèlement l'objet qu'elle remplit, ce qui est la raison d'être d'un avatar à
 * initiale. `getInitialeFontSize` reste la SEULE fonction qui calcule cette taille (1 formule, pas
 * un nouveau catalogue de valeurs magiques par page).
 * Calibration du ratio (mesure Playwright, `Range.getBoundingClientRect()` sur l'encre réelle) :
 * `Range` renvoie la boîte typographique du glyphe (ascendant+descendant selon les métriques de
 * fonte d'Anonymous Pro), pas juste la hauteur de capitale — mesurée ~1,30× le `font-size` calculé,
 * pas 1×. Un premier essai à 0,42 (aire) donnait donc un ratio hauteur-glyphe/diamètre de ~0,54,
 * au-dessus de la fourchette visée [0,38 ; 0,46]. Ratio final 0,32 (0,32 × 1,30 ≈ 0,42, milieu de
 * la fourchette) — voir mesures dans le rapport de vérification, pas dans ce commentaire pour éviter
 * qu'il se désynchronise d'une future recalibration.
 */

import Image from 'next/image';

interface AvatarInitialeProps {
  prenom: string;
  photoUrl?: string | null;
  /** Taille en pixels (défaut 48), ou fonction CSS fluide (ex: "clamp(76px, 22vw, 120px)")
   *  pour rétrécir l'avatar en douceur à très faible largeur sans breakpoint JS
   *  (B18-1 : 120px fixe + gap-6 laissait une colonne texte de 128px seulement à 320px). */
  size?: number | string;
  className?: string;
}

// B43 : ratio unique police/diamètre — voir commentaire d'en-tête. Une taille numérique donne un
// `px` arrondi ; une taille CSS dynamique (`clamp()` de l'avatar héros /prof/[id]) donne un
// `calc()` résolu par le navigateur (le viewport n'est pas connu côté JS au rendu).
const RATIO_POLICE_DIAMETRE = 0.32;

function getInitialeFontSize(size: number | string): string {
  if (typeof size === 'number') return `${Math.round(size * RATIO_POLICE_DIAMETRE)}px`;
  return `calc(${size} * ${RATIO_POLICE_DIAMETRE})`;
}

export default function AvatarInitiale({
  prenom,
  photoUrl,
  size = 48,
  className = '',
}: AvatarInitialeProps) {
  const initiale = prenom.charAt(0).toUpperCase();
  const dim = typeof size === 'number' ? `${size}px` : size;
  const initialeFontSize = getInitialeFontSize(size);
  // next/image width/height : valeur numérique de référence pour la résolution intrinsèque
  const intrinsic = typeof size === 'number' ? size : 120;

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={prenom}
        width={intrinsic}
        height={intrinsic}
        className={`shrink-0 rounded-full object-cover ring-1 ring-secondary-on-dark ${className}`}
        style={{ width: dim, height: dim, minWidth: dim }}
      />
    );
  }

  return (
    <div
      className={`shrink-0 flex items-center justify-center rounded-full bg-secondary/20 ring-1 ring-secondary-on-dark ${className}`}
      style={{ width: dim, height: dim, minWidth: dim }}
    >
      <span
        className="font-mono font-semibold leading-none text-secondary-on-dark"
        style={{ fontSize: initialeFontSize }}
      >
        {initiale}
      </span>
    </div>
  );
}
