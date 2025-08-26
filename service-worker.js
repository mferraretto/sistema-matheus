const CACHE_NAME = 'financeiro-cache-v2';
const URLS_TO_CACHE = [
  'financeiro.html',
  'financeiro.js',
  'css/styles.css',
  'css/components.css',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests so API calls bypass the service worker
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.includes('/partials/') && url.pathname.endsWith('.html')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) =>
      response || fetch(event.request).catch(() => response)
    )
  );
});
