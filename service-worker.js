const CACHE_NAME = 'medchronos-v2.2.6-production'; 
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './css/airbnb.css',
  './css/flatpickr.min.css',
  './renderer.js',
  './js/charts.js',
  './js/dataManager.js',
  './js/fa.js',
  './js/googleSync.js',
  './js/listeners.js',
  './js/manual.js',
  './js/modals.js',
  './js/quotes.js',
  './js/state.js',
  './js/syncModal.js',
  './js/timers.js',
  './js/tools.js',
  './js/uiRefs.js',
  './js/utils.js',
  './js/views.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js',
  'https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js',
  'https://unpkg.com/@popperjs/core@2/dist/umd/popper.min.js',
  'https://unpkg.com/tippy.js@6/dist/tippy-bundle.umd.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Standard caching strategy
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate' || event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // ADDED: { ignoreSearch: true }
        // This tells it to treat "styles.css?v=2.04" the same as "styles.css"
        return caches.match(event.request, { ignoreSearch: true }); 
      })
    );
  }
});