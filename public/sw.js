// Service worker minimal (B22-7) : précache le châssis + la page de repli, pour qu'une navigation
// hors ligne serve /offline plutôt que l'écran blanc par défaut du navigateur.
const CACHE_NAME = 'kala-shell-v1';
const SHELL_URLS = ['/', '/offline', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  // Toujours /offline sur un échec réseau, jamais une page mise en cache silencieusement stale
  // (B22-7) : KALA est un marketplace, une liste de profs périmée servie sans avertissement
  // serait pire qu'un état hors ligne explicite — l'utilisateur doit savoir que ce n'est pas à jour.
  event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
});
