// Service Worker
// Simple, robust caching strategy:
// - Precache core assets on install (App Shell).
// - Cache-first for static assets.
// - Network-first for /api/ responses (demonstrated).
// - Offline fallback to offline.html for navigation requests.

// Version your caches to force update when you change assets
const CACHE_VERSION = 'v1::20251114';
const PRECACHE = [
  './', // index.html
  './offline.html',
  './index.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const RUNTIME = 'runtime-cache';

// Utility: is navigation request
function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_VERSION && key !== RUNTIME)
          .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET for caching
  if (req.method !== 'GET') return;

  // API requests: network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).then(resp => {
        // Clone and store in runtime
        const copy = resp.clone();
        caches.open(RUNTIME).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Navigation requests: try network first, fallback to cache, then offline page
  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req).then(resp => {
        // Update the cache with the page for future offline availability
        const copy = resp.clone();
        caches.open(RUNTIME).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => {
        return caches.match(req).then(matched => matched || caches.match('/offline.html'));
      })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      // Cache fetched asset
      const copy = resp.clone();
      caches.open(RUNTIME).then(cache => cache.put(req, copy));
      return resp;
    })).catch(() => {
      // If it's an image request and failed, return a placeholder if present
      if (req.destination === 'image') {
        return caches.match('/icons/offline-image.png');
      }
    })
  );
});
