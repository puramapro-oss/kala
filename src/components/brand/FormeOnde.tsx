/**
 * FormeOnde — Icône forme d'onde (barres verticales arrondies) pour les cartes/états vides/listes.
 * Version trait 1,5 px pour états vides (jamais un aplat plein, celui-ci est réservé au logo).
 */

interface FormeOndeProps {
  className?: string;
}

export default function FormeOnde({ className = '' }: FormeOndeProps) {
  return (
    <svg
      className={className}
      viewBox="3 3 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* 5 barres verticales arrondies, hauteurs asymétriques — même langage que le logo */}
      <line x1="5.25" y1="9" x2="5.25" y2="15" strokeLinecap="round" />
      <line x1="9" y1="6.75" x2="9" y2="17.25" strokeLinecap="round" />
      <line x1="12.75" y1="4.5" x2="12.75" y2="19.5" strokeLinecap="round" />
      <line x1="16.5" y1="7.5" x2="16.5" y2="16.5" strokeLinecap="round" />
      <line x1="20.25" y1="10.5" x2="20.25" y2="13.5" strokeLinecap="round" />
    </svg>
  );
}
