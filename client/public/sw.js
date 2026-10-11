// v7 (TanStack Query migration, decision 3): the service worker only caches
// the app's own files so the site opens offline. It no longer touches API
// requests — saved data and offline saves belong to TanStack Query in the app
// (client/src/queries/), which scopes them to the signed-in user and sends
// queued saves for real instead of answering with a fake success.
//
// Bumping CACHE_NAME makes activate delete v6's caches, including its copies
// of API responses.
const CACHE_NAME = 'replab-v7';
const SHELL_ASSETS = ['/', '/index.html'];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches, and hand off the old offline queue.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(sendLegacyQueueOnce)
  );
  self.clients.claim();
});

// Fetch strategy: app files only. Anything else (API calls, videos, other
// sites) goes straight to the network, untouched.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!url.protocol.startsWith('http')) return;
  if (event.request.method !== 'GET') return;
  // Our own origin only: intercepting CDN traffic (e.g. the video CDN) has no
  // benefit and breaks media playback on strict browsers.
  if (url.origin !== self.location.origin) return;
  // Safari loads <video> with byte-range (206) requests, which cache-first
  // doesn't preserve — let the network handle them.
  if (event.request.destination === 'video') return;
  if (url.pathname.match(/\.(mp4|webm|mov|m4v|m3u8|ts)$/i)) return;

  // Static assets: cache-first. Only 2xx responses are cached — caching a
  // 404 / HTML error body for a stale asset hash kept serving it as the real
  // asset ("Refused to apply style ... MIME type (text/html)").
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

  // Page loads: network-first, fall back to the cached app shell offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => { sendLegacyQueueOnce(); return response; }).catch(() =>
        caches.match('/index.html').then((cached) =>
          cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        )
      )
    );
  }
});

// The v6 worker queued offline saves in IndexedDB ('replab-sync') and
// answered the app with a fake success. On upgrade, send anything still
// waiting there once (the old version would have sent it on its next
// reconnect), then delete the queue. Entries the server refuses (e.g. an
// expired sign-in) are dropped, as the old worker did.
function openLegacyQueue() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('replab-sync', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('queue', { autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sendLegacyQueue() {
  const db = await openLegacyQueue();
  const entries = await new Promise((resolve) => {
    const req = db.transaction('queue', 'readonly').objectStore('queue').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
  for (const entry of entries) {
    try {
      await fetch(entry.url, { method: entry.method, headers: entry.headers, body: entry.body });
    } catch {
      db.close();
      return false; // still offline: keep the queue and try again later
    }
  }
  db.close();
  await new Promise((resolve) => {
    const req = indexedDB.deleteDatabase('replab-sync');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  return true;
}

// At activation and after each online page load, until it has gone out.
let legacyQueueSent = false;
function sendLegacyQueueOnce() {
  if (legacyQueueSent) return Promise.resolve();
  legacyQueueSent = true;
  return sendLegacyQueue()
    .then((done) => { if (!done) legacyQueueSent = false; })
    .catch(() => { legacyQueueSent = false; });
}

// Logout (AuthContext): wipe the caches. They hold only app files now, but
// a v6 worker still active during the upgrade may hold API responses.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && typeof data === 'object' && data.type === 'CLEAR_AUTH_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => caches.delete(k)))
      ).then(() => {
        if (event.ports && event.ports[0]) {
          try { event.ports[0].postMessage({ ok: true }); } catch (_) {}
        }
      })
    );
  }
});
