// Service Worker for PWA support
const CACHE_NAME = 'gesture-research-v19';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/modal.js?v=202608231800',
  './js/app.js?v=202605272335',
  './js/upload.js?v=202605272335',
  './js/chatbot-config.js?v=202608231810',
  './js/chatbot.js?v=202608231810',
  './papers-data-new.js?v=202608231230',
  './data/user-submissions.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (shouldUseNetworkFirst(event.request, requestUrl)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (shouldUseCacheFirst(requestUrl)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});

function shouldUseNetworkFirst(request, requestUrl) {
  const acceptHeader = request.headers.get('accept') || '';

  return request.mode === 'navigate' ||
    acceptHeader.includes('text/html') ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname.endsWith('.css') ||
    requestUrl.pathname.endsWith('.json') ||
    requestUrl.pathname.endsWith('.xml') ||
    requestUrl.pathname.endsWith('/sw.js') ||
    requestUrl.pathname === '/';
}

function shouldUseCacheFirst(requestUrl) {
  return requestUrl.pathname.includes('/Papers/') ||
    requestUrl.pathname.includes('/images/') ||
    /\.(?:png|jpg|jpeg|gif|svg|webp|avif|pdf)$/i.test(requestUrl.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    await cacheResponse(cache, request, response);
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      const cachedIndex = await cache.match('./index.html');
      if (cachedIndex) {
        return cachedIndex;
      }
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  await cacheResponse(cache, request, response);
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then(async (response) => {
      await cacheResponse(cache, request, response);
      return response;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await networkResponsePromise;
  if (networkResponse) {
    return networkResponse;
  }

  return Response.error();
}

async function cacheResponse(cache, request, response) {
  if (!response || !response.ok || (response.type !== 'basic' && response.type !== 'default')) {
    return;
  }

  await cache.put(request, response.clone());
}
