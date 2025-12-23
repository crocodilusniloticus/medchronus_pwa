const CACHE_NAME = 'medchronos-v2.2.7-production'; 
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css?v=2.2.7',
  './css/airbnb.css?v=2.2.7',
  './css/flatpickr.min.css?v=2.2.7',
  './renderer.js?v=2.2.7',
  './js/charts.js?v=2.2.7',
  './js/dataManager.js?v=2.2.7',
  './js/fa.js?v=2.2.7',
  './js/googleSync.js?v=2.2.7',
  './js/listeners.js?v=2.2.7',
  './js/manual.js?v=2.2.7',
  './js/modals.js?v=2.2.7',
  './js/quotes.js?v=2.2.7',
  './js/state.js?v=2.2.7',
  './js/syncModal.js?v=2.2.7',
  './js/timers.js?v=2.2.7',
  './js/tools.js?v=2.2.7',
  './js/uiRefs.js?v=2.2.7',
  './js/utils.js?v=2.2.7',
  './js/views.js?v=2.2.7',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js?v=2.2.7',
  'https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js?v=2.2.7',
  'https://unpkg.com/@popperjs/core@2/dist/umd/popper.min.js?v=2.2.7',
  'https://unpkg.com/tippy.js@6/dist/tippy-bundle.umd.min.js?v=2.2.7'
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
        // This tells it to treat "styles.css?v=2.2.7" the same as "styles.css?v=2.2.7"
        return caches.match(event.request, { ignoreSearch: true }); 
      })
    );
  }
});