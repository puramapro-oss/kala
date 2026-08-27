import type { ReactNode } from 'react';

interface CardTitleProps {
  children: ReactNode;
  tag?: 'h2' | 'h3' | 'h4';
  className?: string;
}

// B39-6 (passage 39, MOYEN) : le rôle « titre de carte » empruntait 4 balises (h2/h3/h4/p) et
// 3 couleurs (rgba(245,245,250,.78) plein, rgb(245,245,250) plein, rgb(245,240,230)) selon la page
// — dashboard, /gains, /wallet, /devenir-prof, fiche prof, timeline du cours
// rendaient la même fonction visuelle différemment. Un seul composant, un seul rendu : Fraunces
// 18px/600, `--foreground` à l'opacité fixée par le token (jamais une opacité choisie page par
// page), tracking -0.025em (cohérent avec `.font-display`), 12px de marge basse. `tag` garde le
// niveau sémantique correct (h2 pour un titre de section de premier niveau, h3/h4 pour un titre
// de carte imbriquée) sans dupliquer le style.
// B40-2 (passage 40, MAJEUR) : le commentaire ci-dessus affirmait des pages comme consommatrices
// alors qu'elles n'importaient pas le composant (0 occurrence, mesuré par le DA) — corrigé pour
// décrire l'état RÉEL. Consommateurs réels : `/prof/[id]`, `/gains`, `/dashboard`,
// `/devenir-prof`, `/wallet`, `/cours/[id]/timeline`,
// et `components/shared/FormulaireReservation.tsx` (son titre « Récapitulatif », converti dans un
// second temps ce même passage — consommé par `/mes-cours`).
export default function CardTitle({ children, tag = 'h2', className = '' }: CardTitleProps) {
  const Tag = tag;
  return (
    <Tag
      className={`mb-3 font-display text-lg font-semibold tracking-[-0.025em] text-foreground ${className}`}
    >
      {children}
    </Tag>
  );
}
