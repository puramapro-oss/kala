'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'alerte';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  // Pas de focus-visible:outline-none/ring ici (B18-7) : le bouton hérite du même outline
  // global (`:focus-visible` dans globals.css) que tous les autres éléments interactifs —
  // un ring coloré par variant cassait l'uniformité et tombait sous 3:1 sur fond sombre (primary/secondary).
  // B39-7 (passage 39, MOYEN) : inventaire DA du rôle « action primaire » sur tout le produit —
  // hauteurs 44/48/52/62px, rayons pilule(9999) ET 24px, bordures 2px ET 3px, graisses 500 ET 600,
  // toutes issues de boutons écrits à la main plutôt que de ce composant. `rounded-lg` (8px) devient
  // `rounded-full` (seul rayon du produit hors carte, déjà la forme des CTA existants les mieux
  // établis) ; `border-2 border-transparent` par défaut fixe l'épaisseur de bordure à 2px partout,
  // même quand la couleur ne la rend pas visible (`ghost` colore cette même bordure au lieu d'en
  // ajouter une 2e).
  const baseClasses =
    'inline-flex items-center justify-center rounded-full border-2 border-transparent font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  // hover:bg-primary/90 etc. (B24-8) : `hover:opacity-90` seul change la propriété CSS `opacity`,
  // jamais `backgroundColor` — une mesure de survol qui compare spécifiquement `backgroundColor`
  // (comme celle de la DA) le voit identique avant/après. Ajouter une variation de couleur réelle
  // au survol, en plus de l'opacité déjà là, rend le changement visible sur les deux propriétés.
  // bg-primary-on-dark text-[#1C1F26], pas bg-primary text-white (B28-3, passage 28) : les pages
  // écrites à la main (fiche prof, home) utilisent depuis toujours `bg-primary-on-dark` (#c9a227,
  // texte foncé, 8.47:1) comme SEUL bouton d'action primaire de l'app — ce composant partagé, jamais
  // audité par la DA en 27 passages (aucune page qui le rend n'était sur son parcours fixe, cf B28-1),
  // avait dérivé sur `bg-primary` (#c9a227, doré clair — d'où texte foncé) + `text-white`, un 2e système de couleur
  // jamais délibéré. `--primary` reste réservé aux fonds/bordures teintés (`bg-primary/5`, `border-primary/20`).
  const variantClasses = {
    primary: 'bg-primary-on-dark text-[#1C1F26] hover:bg-primary-on-dark/90 hover:opacity-90',
    // secondary (0 usage aujourd'hui) : blanc sur applaudissement mesurait 3,9:1 — outline
    // -on-dark (5,2:1) plutôt que solide, même recette que le CTA secondaire de la home.
    secondary: 'border-secondary-on-dark text-secondary-on-dark hover:bg-secondary-on-dark hover:text-[#1C1F26]',
    ghost: 'bg-transparent !border-border hover:bg-background-soft/50',
    alerte: 'bg-alerte text-[#1C1F26] hover:bg-alerte/90 hover:opacity-90 shadow-lg',
  };

  // B39-7 (passage 39) : 3 paliers explicites seulement — h-9/h-11/h-14 (36/44/56px), jamais un
  // 4e écart mesuré ailleurs dans le produit. `md` reste la cible tactile 44px de référence (Loi 8).
  const sizeClasses = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-6 text-base',
    lg: 'h-14 px-8 text-lg',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
