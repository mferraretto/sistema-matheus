// Import Workbox from the official CDN so the global `workbox` object is available
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js',
);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

const CACHE_VERSION = '20240826';
const CACHE_PREFIX = 'app-cache-v';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const URLS_TO_CACHE = [
  'index.html',
  'index.js',
  'financeiro.html',
  'financeiro.js',
  'login.html',
  'login.js',
  'dashboard-geral.html',
  'dashboard-geral.js',
  'monitoramento.html',
  'monitoramento.js',
  'offline.html',
  'manifest.json',
  'favicon.ico',
  `css/styles.css?v=${CACHE_VERSION}`,
  'css/components.css',
  'css/utilities.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

// Workbox handles the installation and activation steps automatically.
// The precaching list is used by Workbox's precaching module.
workbox.precaching.precacheAndRoute(
  URLS_TO_CACHE.map((url) => ({ url, revision: null })),
);

// A simple routing example: use a CacheFirst strategy for images.
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  new workbox.strategies.CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  }),
);

// Another example: a StaleWhileRevalidate strategy for CSS and JS.
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'assets-cache',
  }),
);

// NetworkFirst strategy for API requests.
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new workbox.strategies.NetworkFirst({
    cacheName: 'api-cache',
  }),
  'GET',
);

// NetworkFirst strategy for HTML navigation requests.
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'document',
  new workbox.strategies.NetworkFirst({
    cacheName: 'html-cache',
  }),
);
