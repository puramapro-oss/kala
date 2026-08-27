/**
 * IconeDistance — règle graduée, pour les statistiques de distance d'un déplacement. Rendu par
 * défaut à 16 px (w-4 h-4) — même facture que FormeOnde.tsx (B30-2).
 */

interface IconeProps {
  className?: string;
}

export default function IconeDistance({ className = '' }: IconeProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2.5" y="8" width="19" height="8" rx="1.2" />
      <path d="M6.5 8v3M10 8v3M13.5 8v3M17 8v3" />
    </svg>
  );
}
