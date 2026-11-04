const CACHE_NAME = 'timesheet-v2';
const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './sheets.js',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k))) // Clear ALL old caches
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Never cache Google APIs
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('accounts.google.com')) {
    return;
  }

  // Network-first strategy: always fetch latest code from server when online
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request)) // Fallback to offline cache only if network fails
  );
});
