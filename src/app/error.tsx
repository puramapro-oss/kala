'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('Erreur applicative :', error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      {/* B41-10 (passage 41) : 36px hors échelle Fraunces à 6 paliers — même recette responsive
          que offline/page.tsx et not-found.tsx (30 mobile / 42 desktop). */}
      <h1 className="font-display text-3xl md:text-[42px] font-bold mb-2">Une erreur est survenue</h1>
      <p className="font-body text-foreground-muted mb-4">
        {error.message || 'Erreur inconnue. Veuillez réessayer.'}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-primary-on-dark text-[#0A0A0F] rounded-lg hover:opacity-90 transition"
      >
        Réessayer
      </button>
    </main>
  );
}
