const CACHE_NAME = 'lua-cache-v4';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!url.protocol.startsWith('http')) return;

  // Network-only: Supabase e APIs
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Navegação: network-first com fallback cache (offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Assets: cache-first com fallback offline
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
            return response;
          }
          const toCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, toCache));
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'lua-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_READY' }));
      })
    );
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'Lua Materna';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    tag: data.tag || 'lua-notif',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) { client.focus(); return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
