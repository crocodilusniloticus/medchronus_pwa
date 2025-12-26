const CACHE_NAME = 'medchronos-v2.2.25-production'; 
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles-v2.2.25.css',
  './css/airbnb.css?v=2.2.25',
  './css/flatpickr.min.css?v=2.2.25',
  './renderer-v2.2.25.js',
  './js/charts-v2.2.25.js',
  './js/dataManager-v2.2.25.js',
  './js/fa-v2.2.25.js',
  './js/googleSync-v2.2.25.js',
  './js/listeners-v2.2.25.js',
  './js/manual-v2.2.25.js',
  './js/modals-v2.2.25.js',
  './js/quotes-v2.2.25.js',
  './js/state-v2.2.25.js',
  './js/syncModal-v2.2.25.js',
  './js/timers-v2.2.25.js',
  './js/tools-v2.2.25.js',
  './js/uiRefs-v2.2.25.js',
  './js/utils-v2.2.25.js',
  './js/views-v2.2.25.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js?v=2.2.25',
  'https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js?v=2.2.25',
  'https://unpkg.com/@popperjs/core@2/dist/umd/popper.min.js?v=2.2.25',
  'https://unpkg.com/tippy.js@6/dist/tippy-bundle.umd.min.js?v=2.2.25'
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
        // This tells it to treat "styles-v2.2.25.css" the same as "styles-v2.2.25.css"
        return caches.match(event.request, { ignoreSearch: true }); 
      })
    );
  }
});