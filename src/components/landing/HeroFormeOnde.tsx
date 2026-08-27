/**
 * HeroFormeOnde — Panneau visuel du héros KALA.
 * Thèse du produit (KALA-BRIEF) : « on choisit son prof en l'entendant jouer, pas en lisant
 * sa bio ». Le panneau porte donc UNE forme d'onde — le signal sonore, signature de l'app —
 * dessinée en SVG avec les tokens CSS uniquement (jamais d'image externe, jamais de rastérisation).
 * Placeholder P0 : la DA définitive (vrais stemmed bars animées, portrait du prof) arrive à la
 * phase design ; ce composant est déjà autonome, responsive et sans dépendance.
 */

export default function HeroFormeOnde({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[color:var(--hero-gradient-start)] via-[color:var(--hero-gradient-mid)] to-[color:var(--hero-gradient-end)] ${className}`}
      aria-hidden="true"
    >
      {/* Forme d'onde : 5 barres verticales arrondies, hauteurs asymétriques — même langage
          que LogoKala et FormeOnde (une seule signature dans tout le produit). */}
      <svg
        viewBox="0 0 120 64"
        fill="var(--secondary)"
        className="h-2/3 w-2/3"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="14" y="24" width="8" height="16" rx="4" />
        <rect x="32" y="16" width="8" height="32" rx="4" />
        <rect x="50" y="8" width="8" height="48" rx="4" />
        <rect x="68" y="18" width="8" height="28" rx="4" />
        <rect x="86" y="26" width="8" height="12" rx="4" />
      </svg>
    </div>
  );
}
