const CACHE_NAME = 'replab-v1';
const SHELL_ASSETS = ['/', '/index.html'];

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

// Fetch strategy:
// - Navigation requests: network-first, fall back to cached index.html
// - Static assets (JS/CSS/images): cache-first, fall back to network
// - API GET requests: network-first, cache response for offline use
// - API POST/PUT requests: try network, queue if offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-http(s) requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // Skip non-GET for caching (handle POST queue separately)
  if (event.request.method !== 'GET') {
    // For API writes, try network and if it fails, store in IndexedDB queue
    if (url.pathname.startsWith('/sessions') || url.pathname.startsWith('/auth/page-visit')) {
      event.respondWith(
        fetch(event.request.clone()).catch(() => {
          return saveToSyncQueue(event.request.clone()).then(() =>
            new Response(JSON.stringify({ queued: true }), {
              headers: { 'Content-Type': 'application/json' },
            })
          );
        })
      );
      return;
    }
    return;
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached ||
        fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
      )
    );
    return;
  }

  // API GET requests: network-first with cache fallback
  if (
    url.pathname.startsWith('/templates') ||
    url.pathname.startsWith('/sessions') ||
    url.pathname.startsWith('/programs') ||
    url.pathname.startsWith('/schedule') ||
    url.pathname.startsWith('/pbs') ||
    url.pathname.startsWith('/exercises')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Navigation: network-first, fallback to cached index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Default: network-first
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
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

  for (let i = 0; i < all.length; i++) {
    const entry = all[i];
    try {
      await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body,
      });
      // Remove from queue on success
      const delTx = db.transaction('queue', 'readwrite');
      delTx.objectStore('queue').delete(keys[i]);
    } catch {
      // Still offline, stop processing
      break;
    }
  }
}

// Listen for sync event (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'replab-sync') {
    event.waitUntil(processSyncQueue());
  }
});

// Fallback: process queue when messaged by the client
self.addEventListener('message', (event) => {
  if (event.data === 'process-sync-queue') {
    processSyncQueue();
  }
});
