// Bumped to v5 (2026-05-11) to evict a poisoned cache of 404/text-html
// responses that the static-asset handler used to store unconditionally.
// Existing users get a clean activate-time cache wipe on their next visit.
const CACHE_NAME = 'replab-v5';
const SHELL_ASSETS = ['/', '/index.html'];

// API paths to cache (GET) for offline use
const CACHEABLE_API = [
  '/templates', '/sessions', '/programs', '/schedule',
  '/pbs', '/exercises', '/metrics', '/sharing',
];

// API paths to queue (POST/PUT/DELETE) when offline
const QUEUEABLE_API = [
  '/sessions', '/schedule', '/templates', '/metrics',
  '/pbs', '/push', '/auth/page-visit',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Bypass the SW for video requests. Safari loads <video> via HTTP byte-range
  // (206 Partial Content) requests and the SW's cache-first strategy doesn't
  // preserve Range semantics — the browser silently refuses to play the result.
  // Let the network handle these directly.
  if (event.request.destination === 'video') return;
  if (url.pathname.match(/\.(mp4|webm|mov|m4v|m3u8|ts)$/i)) return;

  // Bypass the SW for any cross-origin request. We only want to cache our own
  // shell + API; intercepting CDN traffic (e.g. replab-videos.onrender.com)
  // has no benefit and breaks media playback on strict browsers.
  if (url.origin !== self.location.origin) return;

  // Non-GET: try network, queue if offline
  if (event.request.method !== 'GET') {
    const shouldQueue = QUEUEABLE_API.some((p) => url.pathname.startsWith(p));
    if (shouldQueue) {
      event.respondWith(
        fetch(event.request.clone()).catch(() => {
          return saveToSyncQueue(event.request.clone()).then(() => {
            // Notify all clients that a request was queued
            self.clients.matchAll().then((clients) => {
              clients.forEach((c) => c.postMessage({ type: 'queued-offline' }));
            });
            return new Response(JSON.stringify({ queued: true, offline: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          });
        })
      );
      return;
    }
    return;
  }

  // Static assets: cache-first (video extensions dropped — handled above).
  // CRITICAL: only cache 2xx responses. The previous version stored every
  // response including 404s and HTML-typed error bodies — once a stale asset
  // hash 404'd through the SPA fallback, the SW kept serving that 404 as if
  // it were the real asset, producing "Refused to apply style ... MIME type
  // (text/html)" errors that persisted through every refresh.
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      )
    );
    return;
  }

  // API GET requests: network-first with cache fallback. Same response.ok
  // guard as the static-asset branch — don't cache 4xx/5xx responses or
  // we'll keep replaying errors instead of falling back to real data.
  if (CACHEABLE_API.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || new Response(JSON.stringify({ error: 'Offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } })
          )
        )
    );
    return;
  }

  // Navigation: network-first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/index.html').then((cached) =>
          cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        )
      )
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) =>
        cached || new Response('Offline', { status: 503 })
      )
    )
  );
});

// IndexedDB helpers for sync queue
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('replab-sync', 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore('queue', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToSyncQueue(request) {
  const db = await openSyncDB();
  const body = await request.text();
  const entry = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    timestamp: Date.now(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').add(entry);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function processSyncQueue() {
  const db = await openSyncDB();
  const tx = db.transaction('queue', 'readonly');
  const store = tx.objectStore('queue');
  const all = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
  const keys = await new Promise((resolve) => {
    const req = store.getAllKeys();
    req.onsuccess = () => resolve(req.result);
  });

  let synced = 0;
  for (let i = 0; i < all.length; i++) {
    const entry = all[i];
    try {
      await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      const delTx = db.transaction('queue', 'readwrite');
      delTx.objectStore('queue').delete(keys[i]);
      synced++;
    } catch {
      break;
    }
  }

  // Notify clients that sync is done
  if (synced > 0) {
    self.clients.matchAll().then((clients) => {
      clients.forEach((c) => c.postMessage({ type: 'sync-complete', count: synced }));
    });
  }
}

// Background Sync API
self.addEventListener('sync', (event) => {
  if (event.tag === 'replab-sync') {
    event.waitUntil(processSyncQueue());
  }
});

// Process queue when messaged by the client
self.addEventListener('message', (event) => {
  if (event.data === 'process-sync-queue') {
    processSyncQueue();
  }
});
