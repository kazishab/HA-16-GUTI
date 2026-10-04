/* HA 16 GUTI service worker
   - Network-first for pages/code, so new GitHub deploys show up automatically.
   - Cache is only an offline fallback.
   - Bump VERSION if you ever want to force-clear every old cache. */
const VERSION = 'v3-2026-10-04';
const CACHE = 'ha16guti-' + VERSION;
const PRECACHE = ['./', './index.html', './manifest.json', './icon-16.png', './icon-32.png', './icon-180.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // add one by one so a missing file never breaks the install
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();            // activate the new worker immediately
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));  // remove all old caches
    await self.clients.claim();          // take control of open pages
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch Firebase / ads / CDN requests
  if (url.pathname.endsWith('/sw.js')) return;        // always let the browser fetch sw.js fresh

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // network first (bypass HTTP cache), fall back to cache after 4s or when offline
      const net = fetch(req, { cache: 'no-cache' });
      const res = await Promise.race([
        net,
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const home = (await cache.match('./index.html')) || (await cache.match('./'));
        if (home) return home;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
