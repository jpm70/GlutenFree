// GlutenZero — service worker
// Estrategia:
//   - Archivos propios (HTML/JS/iconos): cache-first con refresh en background
//   - Librerías de CDN con versión fija (React, lector de códigos…): cache-first
//     permanente. Son inmutables, y sin ellas la app no arranca sin conexión.
//   - Cualquier otra cosa (APIs externas como Open Food Facts): SIEMPRE red, sin cachear
const CACHE = 'glutenzero-v19';
const CDN_CACHE = 'glutenzero-cdn-v1';  // no se borra al cambiar de versión
const ASSETS = [
  './',
  './index.html',
  './dist/app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];
// Imprescindibles para abrir la app y ver productos guardados sin conexión
const CDN_ASSETS = [
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
];
const CDN_HOSTS = ['unpkg.com', 'cdn.jsdelivr.net'];

// Solo URLs con versión exacta («paquete@1.2.3»): esas nunca cambian de contenido
const isVersionedCdn = (url) => CDN_HOSTS.includes(url.hostname) && /@\d+\.\d+\.\d+/.test(url.pathname);

self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}),
    caches.open(CDN_CACHE).then((c) => c.addAll(CDN_ASSETS.map((u) => new Request(u, { mode: 'cors' })))).catch(() => {}),
  ]));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== CDN_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (!sameOrigin) {
    if (isVersionedCdn(url)) {
      e.respondWith(
        caches.open(CDN_CACHE).then((c) =>
          c.match(req, { ignoreVary: true }).then((cached) => cached || fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
            return res;
          }))
        )
      );
    }
    // Peticiones a APIs externas (Open Food Facts, etc.) NUNCA pasan por el cache.
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
