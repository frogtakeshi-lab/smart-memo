/* ========================================
   SERVICE WORKER - Offline support
   ======================================== */

const CACHE_NAME = 'smart-memo-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './css/themes.css',
  './css/note-types.css',
  './css/memo-editor.css',
  './js/db.js',
  './js/memo.js',
  './js/image.js',
  './js/audio.js',
  './js/note-types.js',
  './js/category.js',
  './js/search.js',
  './js/ui.js',
  './js/app.js',
  './manifest.json'
];

// Install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch - Network first, fallback to cache
self.addEventListener('fetch', (e) => {
  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Skip external requests (fonts, CDN)
  if (!e.request.url.startsWith(self.location.origin)) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
