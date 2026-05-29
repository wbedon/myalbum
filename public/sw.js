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

// ── Web Push ────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'MyAlbum', body: e.data.text() }; }

  const { title = 'MyAlbum 2026', body = '', icon = '/icons/icon-192.png', badge = '/icons/icon-192.png', tag = 'default', url = '/' } = data;

  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon, badge, tag,
      data: { url },
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
