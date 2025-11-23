const CACHE_VERSION = 'v5';
const STATIC_CACHE = `belchior-receita-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `belchior-receita-runtime-${CACHE_VERSION}`;

// Só pré-cachear ativos estáticos que não quebram atualização do app shell
const PRECACHE_URLS = [
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
];

// Helpers
const shouldHandleFetch = (request) => {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false; // deixar CDN/externo livre
  if (url.pathname.startsWith('/api/')) return false; // não cachear API
  if (url.pathname === '/sw.js') return false; // nunca cachear o próprio SW
  return true;
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.status === 200) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
};

const networkFirst = async (request, cacheName = RUNTIME_CACHE) => {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('Você está offline e o recurso não está em cache.', {
      status: 503,
      statusText: 'Offline',
    });
  }
};

const isAppShellAsset = (request) => {
  return ['document', 'script', 'style', 'manifest'].includes(request.destination);
};

self.addEventListener('install', (event) => {
  console.log('[SW] Instalando service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Cache estático aberto');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (![STATIC_CACHE, RUNTIME_CACHE].includes(cacheName)) {
            console.log('[SW] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
          // Mesmo que o nome seja igual, força limpar dentro para evitar lixo
          return caches.open(cacheName).then((cache) => cache.keys().then((entries) =>
            Promise.all(entries.map((req) => cache.delete(req)))
          ));
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (!shouldHandleFetch(event.request)) return;

  const url = new URL(event.request.url);

  // Navegações usam network-first para garantir HTML/JS atualizados (evita ficar preso em versão antiga)
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App shell assets (JS/CSS/manifest) usam network-first para evitar versão antiga
  if (isAppShellAsset(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Ativos pré-cacheados (ícones, manifest)
  if (PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Demais ativos de mesma origem (CSS/JS/imagens) usam cache-first com fallback para rede
  event.respondWith(cacheFirst(event.request, RUNTIME_CACHE));
});
