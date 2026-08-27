/**
 * /offline — page de repli hors ligne (B22-7, B23-2).
 * Servie par le service worker quand une navigation échoue faute de réseau, plutôt que l'écran
 * blanc par défaut du navigateur (interdit CLAUDE.md §13 erreur n°15 : "jamais écran blanc").
 * B23-2 : le shell précaché par sw.js n'inclut QUE le HTML/CSS, pas les chunks JS — React ne
 * s'hydrate donc jamais sur cette page servie hors ligne, et un `onClick` n'est alors jamais
 * attaché (bouton mort, prouvé par un vrai `.click()` Playwright qui ne déclenche aucune navigation).
 * Un `<a href="/">` fonctionne sans JS : c'est une navigation native du navigateur, qui retente
 * `/` et retombe elle-même sur `/offline` si le réseau manque encore (aucune boucle possible).
 */

import FormeOnde from '@/components/brand/FormeOnde';
import { APP_NAME } from '@/lib/constants';

// title dédié (B28-9, passage 28) : même correctif que not-found.tsx.
export const metadata = {
  title: `Hors ligne · ${APP_NAME}`,
};

export default function OfflinePage() {
  return (
    // flex-1, pas min-h-screen (B26-7, passage 26 — même correctif que not-found.tsx, appliqué ici
    // par prévention : cette page n'était pas dans la recette DA de ce passage mais partage
    // exactement la même structure nichée dans le <main flex-1 flex-col> de layout.tsx depuis B25-8).
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <FormeOnde className="h-16 w-16 text-primary-on-dark" aria-hidden="true" />
      <div className="space-y-2">
        {/* B41-10 (passage 41) : 36px (md) hors échelle Fraunces à 6 paliers — remonté à 42px. */}
        <h1 className="font-display text-3xl md:text-[42px] font-bold text-foreground">Vous êtes hors ligne</h1>
        <p className="font-body text-foreground-muted max-w-sm">
          {APP_NAME} revient dès que la connexion revient. Vérifiez votre réseau, puis réessayez.
        </p>
      </div>
      <a
        href="/"
        className="rounded-pill bg-primary-on-dark px-6 py-3 font-semibold font-body text-[#0A0A0F] shadow-lg transition hover:opacity-90"
      >
        Réessayer
      </a>
    </div>
  );
}
