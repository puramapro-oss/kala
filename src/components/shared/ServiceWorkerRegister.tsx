'use client';

/**
 * Enregistre le service worker minimal (B22-7) qui sert /offline en cas de coupure réseau.
 * Composant sans rendu — 'use client' pour accéder à `navigator`.
 */

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Échec silencieux : le pire cas retombe sur l'écran blanc précédent, pas de régression.
      });
    }
  }, []);

  return null;
}
