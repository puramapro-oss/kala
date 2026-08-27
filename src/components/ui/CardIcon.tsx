import type { ReactNode } from 'react';

interface CardIconProps {
  children: ReactNode;
  className?: string;
}

// B40-1 (passage 40, MAJEUR) : le DA a trouvé la cause racine de la 4e régression consécutive de
// la gouttière icône→titre — deux pages posaient DEUX règles incompatibles pour la même icône
// (glyphe 20px) : l'une réservait `pl-20` (80px, dimensionné pour l'avatar 40px de la
// carte voisine dans la même colonne) donnant une gouttière de 36px, l'autre réservait
// `pl-[60px]` (dimensionné pour l'icône réelle 20px) donnant 16px. Même composant, même rôle, deux
// gouttières. Recette DA : UNE SEULE boîte d'icône fixe 40×40px, quelle que soit la taille réelle
// du glyphe SVG à l'intérieur (centré via flex) — le retrait de carte devient UNE constante
// universelle `pl-20` (24+40+16=80) sur CHAQUE carte à icône du produit (aujourd'hui la timeline
// du cours), plus jamais calculé au cas par cas selon la taille de l'icône réelle.
export default function CardIcon({ children, className = '' }: CardIconProps) {
  return (
    <div className={`absolute left-6 top-6 flex h-10 w-10 items-center justify-center ${className}`}>
      {children}
    </div>
  );
}
