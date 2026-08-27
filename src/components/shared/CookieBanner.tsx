'use client';

import CookieConsentBanner from '@/lib/legal/components/CookieConsentBanner';
import { APP_NAME } from '@/lib/constants';

/**
 * Wrapper client (NIYAMA) : une fonction `onConsent` ne peut pas traverser la frontière
 * Server → Client Component (RootLayout est un Server Component) — ce composant encapsule
 * le callback de synchronisation côté client, `layout.tsx` ne rend qu'un élément sans prop
 * fonction.
 */
export default function CookieBanner() {
  return (
    <CookieConsentBanner
      appName={APP_NAME}
      onConsent={(consent) => {
        fetch('/api/legal/cookie-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mesure: consent.mesure, marketing: consent.marketing }),
        }).catch(() => {});
      }}
    />
  );
}
