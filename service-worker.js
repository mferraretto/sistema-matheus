const CACHE_VERSION = '20240826';
const CACHE_PREFIX  = 'app-cache-v';
const CACHE_NAME    = `${CACHE_PREFIX}${CACHE_VERSION}`;
const URLS_TO_CACHE = [
  'index.html',
  'index.js',
  'financeiro.html',
  'financeiro.js',
  `css/styles.css?v=${CACHE_VERSION}`,
  'css/components.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

const LEGACY_URLS = {
  '/CONTROLE DE SOBRAS SHOPEE.html': '/controle-sobras-shopee.html',
  '/Gerenciamento de ANUNCIOS E DESEMPENHO.html': '/gerenciamento-anuncios-desempenho.html',
  '/SISTEMA DE CUSTEIO DE PRODUÇÃO E PRODUTOS.html': '/sistema-custeio-producao.html',
  '/Sistema de Precificação COM IMPORTAÇÃO DE PLANILHA DE PROMOÇÕES SHOPEE.html': '/sistema-precificacao-importacao-planilha-promocoes-shopee.html'
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests so API calls bypass the service worker
  if (url.origin !== self.location.origin) {
    return;
  }

  const pathname = decodeURI(url.pathname);
  if (LEGACY_URLS[pathname]) {
    event.respondWith(Response.redirect(LEGACY_URLS[pathname], 301));
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
