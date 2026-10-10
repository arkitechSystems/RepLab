// Load-by-path helpers for screens that manage their own state (Workouts,
// Calendar, …). Drop-in replacements for the old api.js saved-copy calls,
// backed by the TanStack Query cache:
//
//   api(path, { cache: true })  →  loadPath(path, { signal })
//   cacheOnly(path)             →  savedPath(path)
//   cachedAt(path)              →  savedAt(path)
//
// The screen's own logic stays as it was; loading, retries, de-duplication
// and the on-device saved copy come from TanStack Query.
import { legacyCacheEntries } from '../api';
import { queryClient } from './queryClient';
import { pathKey, fetchPath } from './keys';

// Resolved once the saved cache has been restored from the device at
// start-up (QueryProvider), so a screen asking for its saved copy right
// away doesn't miss it. Gives up after a short wait — the live load still
// runs either way.
let markRestored;
let restored;
// Called when QueryProvider mounts (once per app start; per test in tests).
export function beginCacheRestore() {
  restored = new Promise((resolve) => { markRestored = resolve; });
}
beginCacheRestore();
export function markCacheRestored() { markRestored(); }
const RESTORE_WAIT_MS = 1500;
function whenRestored() {
  return Promise.race([restored, new Promise((r) => setTimeout(r, RESTORE_WAIT_MS))]);
}

// First run after the migration: saved copies made by the old api.js cache
// become TanStack saved copies (keeping their original time), unless the
// cache already has newer data for that path. Runs after the restore.
export function importLegacyCache(client = queryClient) {
  for (const { path, at, data } of legacyCacheEntries()) {
    const key = pathKey(path);
    const state = client.getQueryState(key);
    if (state?.data !== undefined && state.dataUpdatedAt >= (at || 0)) continue;
    client.setQueryData(key, data, { updatedAt: at || Date.now() });
  }
}

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

// Live data for a GET path, always checked with the server (same as the old
// api(path) call), through the shared cache: two screens asking at once share
// one request, connection errors are retried, and the result becomes the
// saved copy. A caller's aborted signal rejects with AbortError, as before;
// the request itself still finishes and updates the cache.
export function loadPath(path, { signal } = {}) {
  if (signal?.aborted) return Promise.reject(abortError());
  const request = queryClient.fetchQuery({ queryKey: pathKey(path), queryFn: fetchPath(path), staleTime: 0 });
  if (!signal) return request;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    request.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

// The saved copy of a GET path, or a rejection ({ notCached: true }) when
// there isn't one — same contract as the old cacheOnly().
export async function savedPath(path) {
  await whenRestored();
  const data = queryClient.getQueryData(pathKey(path));
  if (data === undefined) {
    const err = new Error('Not cached');
    err.notCached = true;
    throw err;
  }
  return data;
}

// When the saved copy of a GET path was loaded (ms), or null.
export function savedAt(path) {
  const state = queryClient.getQueryState(pathKey(path));
  return state?.data !== undefined && state.dataUpdatedAt ? state.dataUpdatedAt : null;
}
