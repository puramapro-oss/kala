'use client';

/**
 * NoteProf — affichage unifié de la note (B14-5). Étoile dessinée (icône, pas glyphe texte),
 * toujours avant le chiffre, même teinte. Utilisé sur home + fiche prof.
 * S41-a (passage 41) : gouttière icône→texte fixée à 2 valeurs seulement, selon la taille de
 * l'icône — 8px (`gap-2`) pour un glyphe inline ≤20px (`sm`, 14px), 16px (`gap-4`) au-delà
 * (`lg`, 22px > 20px) — avant ce correctif les deux variantes partageaient `gap-2`.
 */

import { Star } from 'lucide-react';

interface NoteProfProps {
  note: string; // déjà formaté fr-FR, ex: "4,9"
  size?: 'sm' | 'lg';
  className?: string;
}

export default function NoteProf({ note, size = 'sm', className = '' }: NoteProfProps) {
  const iconSize = size === 'lg' ? 22 : 14;
  // B41-10 (passage 41) : 28px (lg) et 14px (sm) n'appartenaient pas à l'échelle Fraunces à 6
  // paliers (60/42/30 en 700, 24/18/16 en 600) — remontés au palier le plus proche : 28→30/700,
  // 14→16/600.
  const textClass = size === 'lg' ? 'font-display text-[30px] font-bold' : 'font-display text-base font-semibold';
  const gapClass = size === 'lg' ? 'gap-4' : 'gap-2';

  return (
    <span className={`inline-flex items-center ${gapClass} text-primary-on-dark ${className}`}>
      <Star size={iconSize} fill="currentColor" strokeWidth={0} aria-hidden="true" />
      <span className={textClass}>{note}</span>
    </span>
  );
}
