// Isaac PWA Service Worker
const CACHE_NAME = 'isaac-v4';
const OFFLINE_URL = '/offline.html';

// Only cache the offline fallback page
const PRECACHE_ASSETS = [
  '/offline.html',
];

// Install event - cache offline page only
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up ALL old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network only, offline fallback for navigation
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  // Only intercept navigation requests (page loads) for offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
  // All other requests (JS, CSS, images) go straight to network/browser cache
  // Hashed assets are cached by the browser via nginx Cache-Control headers
});
