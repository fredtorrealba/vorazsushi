/* Service Worker de VORAZ Sushi
   Estrategia: stale-while-revalidate — sirve desde caché al instante
   y actualiza en segundo plano. Permite abrir el menú sin conexión. */

const CACHE = 'voraz-v5';
const CORE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Solo cacheamos peticiones GET
  if (request.method !== 'GET') return;

  // HTML / navegación: NETWORK-FIRST. Siempre intenta la última versión
  // del sitio; si no hay conexión, cae al HTML cacheado (modo offline).
  const aceptaHtml = (request.headers.get('accept') || '').includes('text/html');
  if (request.mode === 'navigate' || aceptaHtml) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Resto de assets (imágenes, manifest, etc.): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200 &&
              (response.type === 'basic' || response.type === 'cors')) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
