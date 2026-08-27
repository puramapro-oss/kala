/**
 * IconeNote — feuillet corné + une ligne, pour les entrées "note" du journal de cours.
 * B31-10 (passage 31) : l'ancienne icône 4 tracés occupait moins d'un tiers de sa boîte de 24 px
 * et se lisait comme une poussière bronze. Recette DA appliquée : un feuillet corné (le carnet du
 * prof) qui occupe ~85 % de la boîte, même densité de tracé que ses voisines.
 * Bonus : chaque entrée du journal a son propre motif (deux icônes = deux sens).
 */

interface IconeProps {
  className?: string;
}

export default function IconeNote({ className = '' }: IconeProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Feuillet : contour avec coin supérieur droit corné */}
      <path d="M15.5 2.5 H6.5 A1.5 1.5 0 0 0 5 4 v16 a1.5 1.5 0 0 0 1.5 1.5 h11 A1.5 1.5 0 0 0 19 20 V6 Z" />
      {/* La corne */}
      <path d="M15.5 2.5 V6 H19" />
      {/* Une ligne d'écriture */}
      <path d="M8.5 13.5 H15.5" />
    </svg>
  );
}
