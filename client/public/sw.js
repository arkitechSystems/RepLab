// Bumped to v6 (2026-05-20) to evict any cross-user leak from v5. v5 cached
// authed API GETs by URL alone, so on a shared device User B briefly saw
// User A's /templates and /sessions on first paint after login. v6 fixes
// this two ways: (1) logout now posts CLEAR_AUTH_CACHE to wipe the cache,
// and (2) cached authed responses older than MAX_AUTHED_CACHE_AGE_MS are
// treated as stale and not served from cache (network-only fallback).
const CACHE_NAME = 'replab-v6';
const SHELL_ASSETS = ['/', '/index.html'];

// Stale-cache cutoff for authed API responses. 10 minutes is short enough
// that a forgotten-to-logout session can't leak meaningful data, long enough
// that a flaky network on the subway can still serve a recent /templates.
const MAX_AUTHED_CACHE_AGE_MS = 10 * 60 * 1000;
const CACHE_TIMESTAMP_HEADER = 'x-replab-sw-cached-at';

// API paths that are SAFE TO CACHE without auth scoping. /exercises is the
// public exercise library — same response for every user, no privacy issue.
const PUBLIC_CACHEABLE_API = ['/exercises'];

// API paths that are per-user. These are still cached for offline use, but
// (a) the cache is wiped on logout via CLEAR_AUTH_CACHE, and (b) any cached
// entry older than MAX_AUTHED_CACHE_AGE_MS is bypassed.
const AUTHED_CACHEABLE_API = [
  '/templates', '/sessions', '/programs', '/schedule',
  '/pbs', '/metrics', '/sharing',
];

const CACHEABLE_API = [...PUBLIC_CACHEABLE_API, ...AUTHED_CACHEABLE_API];

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
    const isAuthed = AUTHED_CACHEABLE_API.some((p) => url.pathname.startsWith(p));
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            // Stamp the cache time so the offline fallback can age-check
            // authed entries (privacy: don't serve a stale logged-out user's
            // data to whoever is in front of the device now).
            caches.open(CACHE_NAME).then(async (cache) => {
              const body = await clone.blob();
              const headers = new Headers(clone.headers);
              headers.set(CACHE_TIMESTAMP_HEADER, String(Date.now()));
              const stamped = new Response(body, {
                status: clone.status,
                statusText: clone.statusText,
                headers,
              });
              await cache.put(event.request, stamped);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (!cached) {
              return new Response(JSON.stringify({ error: 'Offline', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } });
            }
            // For authed endpoints, refuse to serve cache older than the
            // cutoff — better an offline error than a privacy leak.
            if (isAuthed) {
              const cachedAt = parseInt(cached.headers.get(CACHE_TIMESTAMP_HEADER) || '0', 10);
              if (!cachedAt || (Date.now() - cachedAt) > MAX_AUTHED_CACHE_AGE_MS) {
                return new Response(JSON.stringify({ error: 'Offline', offline: true, reason: 'stale' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
              }
            }
            return cached;
          })
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

// Process queue when messaged by the client.
//
// Also handles CLEAR_AUTH_CACHE — fired by AuthContext.logout BEFORE
// localStorage is cleared so we can wipe any cached per-user API responses
// (/templates, /sessions, /pbs, etc.) before the next user logs in on the
// same device. Without this, the SW would serve User A's cached data to
// User B on first paint until the network responds.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data === 'process-sync-queue') {
    processSyncQueue();
    return;
  }
  if (data && typeof data === 'object' && data.type === 'CLEAR_AUTH_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => caches.delete(k)))
      ).then(() => {
        // Acknowledge so the client can clear localStorage afterward.
        if (event.ports && event.ports[0]) {
          try { event.ports[0].postMessage({ ok: true }); } catch (_) {}
        }
      })
    );
  }
});
