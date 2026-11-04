// Cache only the public application shell. Never cache auth, API or booking responses.
const CACHE_NAME = 'get-by-boat-shell-v1';
const SHELL = ['/', '/index.html', '/assets/favicon.svg', '/assets/app-icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('get-by-boat-shell-') && key !== CACHE_NAME)
      .map(key => caches.delete(key))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
});
