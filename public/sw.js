const CACHE = 'myalbum-v1';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Bypass: non-GET, cross-origin API calls (supabase), browser-sync
  if (request.method !== 'GET') return;
  if (url.hostname !== self.location.hostname) return;

  // Navigation requests: network-first, fall back to cached index
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => { const clone = res.clone(); caches.open(CACHE).then((c) => c.put(request, clone)); return res; })
        .catch(() => caches.match('/') || fetch(request))
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/templates/') || url.pathname.startsWith('/uniforms/')) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // Everything else: network-first (no cache)
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});
