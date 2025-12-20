const CACHE_NAME = 'medchronos-v10'; // Bumped version to FORCE update
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
  self.skipWaiting(); // Force this new worker to become active immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map(url => {
            return cache.add(url).catch(err => {
                console.error('Failed to cache:', url, err);
            });
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});