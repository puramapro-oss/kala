/**
 * LogoKala — Logo header/footer.
 * Lettre « K » dont la jambe diagonale se prolonge en trois barres de forme d'onde :
 * la musique entre dans la lettre. Aucune image externe, tokens CSS uniquement.
 */

interface LogoProps {
  className?: string;
  fill?: string;
}

export default function LogoKala({ className = '', fill = 'currentColor' }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Barre verticale du K */}
      <rect x="8" y="10" width="8" height="44" rx="4" fill={fill} />

      {/* Diagonale haute du K, prolongée en barres de forme d'onde (la « musique » du K) */}
      <path d="M22 14 L38 32 L22 50" stroke={fill} strokeWidth="8" strokeLinecap="round" />

      {/* Trois barres d'onde à droite — hautesurs décroissantes, comme un son qui s'éteint */}
      <rect x="46" y="20" width="6" height="24" rx="3" fill={fill} opacity="0.9" />
      <rect x="55" y="24" width="6" height="16" rx="3" fill={fill} opacity="0.6" />
    </svg>
  );
}
