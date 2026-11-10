// Keep VERSION identical to APP_VERSION in index.html and bump it on every release:
// a changed sw.js is what makes installed copies of the app notice the update.
const VERSION = '1.1.0';
const CACHE = 'ha-16-guti-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-16.png',
  './icon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // a missing file must not make the whole install fail
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase, AdSense and other cross-origin requests go straight to the network
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' ||
                 url.pathname.endsWith('/index.html') ||
                 url.pathname.endsWith('/manifest.json');

  if (isPage) {
    // network first: a new release is picked up on the next open; cache only when offline
    event.respondWith(
      fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // icons and other static files: cache first, refreshed in the background
  event.respondWith(
    caches.match(req).then(hit => {
      const refresh = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
