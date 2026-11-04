const CACHE_NAME = 'timesheet-v1';
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
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for Google API calls, cache-first for shell
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('accounts.google.com')) {
    return; // let browser handle
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
