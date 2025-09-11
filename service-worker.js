importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

const PRECACHE_MANIFEST = [
  {url: 'index.html', revision: null},
  {url: 'index.js', revision: null},
  {url: 'financeiro.html', revision: null},
  {url: 'financeiro.js', revision: null},
  {url: 'css/styles.css', revision: null},
  {url: 'css/components.css', revision: null},
  {url: 'css/utilities.css', revision: null},
  {url: 'icons/icon-192.png', revision: null},
  {url: 'icons/icon-512.png', revision: null},
  {url: 'offline.html', revision: '1'},
];

workbox.core.skipWaiting();
workbox.core.clientsClaim();

workbox.precaching.precacheAndRoute((self.__WB_MANIFEST || []).concat(PRECACHE_MANIFEST), {
  ignoreURLParametersMatching: [/.*/]
});

workbox.precaching.cleanupOutdatedCaches();

workbox.routing.registerRoute(
  ({request}) => request.mode === 'navigate',
  new workbox.strategies.NetworkFirst({
    cacheName: 'pages-cache',
  })
);

workbox.routing.registerRoute(
  ({request}) => ['style', 'script', 'image'].includes(request.destination),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'assets-cache',
  })
);

workbox.routing.setCatchHandler(async ({event}) => {
  if (event.request.mode === 'navigate') {
    return caches.match('offline.html', {ignoreSearch: true});
  }
  return Response.error();
});
