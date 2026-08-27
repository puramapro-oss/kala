/**
 * IconeDuree — horloge, pour les statistiques de durée d'une séance. Rendu par défaut à 16 px
 * (w-4 h-4) — même facture que FormeOnde.tsx (B30-2).
 */

interface IconeProps {
  className?: string;
}

export default function IconeDuree({ className = '' }: IconeProps) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
