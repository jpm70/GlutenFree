// GlutenZero — service worker
// Estrategia:
//   - Archivos propios (HTML/JS/iconos): cache-first con refresh en background
//   - Cualquier otra cosa (APIs externas como Open Food Facts): SIEMPRE red, sin cachear
const CACHE = 'glutenzero-v4';
const ASSETS = [
  './',
  './index.html',
  './app-mobile.jsx',
  './gluten-engine.jsx',
  './ios-frame.jsx',
  './tweaks-panel.jsx',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Peticiones a APIs externas (Open Food Facts, etc.) NUNCA pasan por el cache.
  // Dejamos que el navegador las haga directamente.
  if (!sameOrigin) {
    return; // sin respondWith → comportamiento por defecto
  }

  // Para archivos propios: cache-first con refresh en background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
