const CACHE_NAME = 'ibex-had-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/bahkm-honey-logo-header-ready.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline pages and assets');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[Service Worker] Pre-cache warning: some files could not be pre-cached contextually', err);
      });
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Cleaning up old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Absolutely DO NOT cache or intercept Supabase requests or non-GET requests
  if (
    event.request.method !== 'GET' ||
    requestUrl.hostname.includes('supabase.co') ||
    requestUrl.pathname.startsWith('/api') ||
    requestUrl.protocol === 'ws:' ||
    requestUrl.protocol === 'wss:'
  ) {
    // Let network handles this without intervention
    return;
  }

  // 2. Standard static assets fallback (Stale-While-Revalidate/Network-First for local assets)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh asset in background and update cache silently
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Silently ignore background fetch errors when offline
          });
        return cachedResponse;
      }

      // If not in cache, fallback to fetching from network
      return fetch(event.request).then((networkResponse) => {
        // Cache newly requested local documents/assets dynamically if applicable
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          !requestUrl.pathname.includes('chrome-extension')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});
