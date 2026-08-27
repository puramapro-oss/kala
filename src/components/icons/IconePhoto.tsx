/**
 * IconePhoto — objectif d'appareil photo, pour les entrées "photo" du journal de cours. Même
 * facture que FormeOnde.tsx (B30-2).
 */

interface IconeProps {
  className?: string;
}

export default function IconePhoto({ className = '' }: IconeProps) {
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
      <path d="M3.5 8.5a2 2 0 0 1 2-2h2.2l1.1-1.6a2 2 0 0 1 1.65-.9h3.1a2 2 0 0 1 1.65.9l1.1 1.6h2.2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9Z" />
      <circle cx="12" cy="13" r="3.75" />
    </svg>
  );
}
