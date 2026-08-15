// Bump ad ogni release insieme a APP_VERSION in index.html: forza la pulizia
// della cache precedente e garantisce che l'aggiornamento venga effettivamente
// scaricato invece di restare bloccati su una versione vecchia in cache.
const CACHE_NAME = 'irrigaha-v4';
const APP_SHELL = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three.min.js',
  './vendor/OrbitControls.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Non intercettare mai le chiamate verso Home Assistant o altre origini.
  if (!isSameOrigin) return;

  const isHtml = event.request.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('index.html');

  if (isHtml) {
    // Rete-prima per la pagina principale: appena l'add-on serve un file
    // aggiornato lo si vede subito, senza restare bloccati su una versione
    // vecchia in cache. La cache e' solo un fallback per l'uso offline.
    event.respondWith(
      fetch(event.request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-prima per gli asset statici (librerie 3D, icone, manifest):
  // cambiano raramente e il nome della cache viene comunque invalidato
  // ad ogni release tramite CACHE_NAME.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      }).catch(() => cached);
    })
  );
});
