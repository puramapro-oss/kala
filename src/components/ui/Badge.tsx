'use client';

import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

export default function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';

  // B38-30 (passage 38, MOYEN) : le fond `bg-background-soft/50` de la variante `default` est
  // quasi invisible sur le fond déjà sombre de la page — à côté d'un badge `success` (fond plein),
  // ce statut lisait comme du texte nu, pas comme une pilule (2 composants visuels pour le même
  // champ "statut"). Bordure `--border-control` (3,32:1, déjà le token dédié aux contrôles
  // identifiables par leur seul contour) ajoutée : le contour rend la forme pilule lisible même
  // quand le remplissage reste discret — un seul composant, seule la teinte change entre états.
  const variantClasses = {
    default: 'bg-background-soft/50 backdrop-blur-sm text-foreground border border-[color:var(--border-control)]',
    success: 'bg-primary-on-dark text-[#0A0A0F]',
    warning: 'bg-secondary text-white',
    error: 'bg-alert text-white',
  };

  return <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</span>;
}
