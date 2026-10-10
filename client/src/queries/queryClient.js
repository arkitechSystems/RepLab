// The app's one TanStack Query client: loading, caching, retries and offline
// saving for every converted screen. Decisions behind these settings are in
// docs/tanstack-query-migration.md.
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { onApiCacheClear } from '../api';

const SECOND = 1000;
// See persistOptions.buster.
export const CACHE_SHAPE_VERSION = '1';
const DAY = 24 * 60 * 60 * SECOND;

// Saved copies (and queued saves) are kept on the device this long.
export const PERSIST_MAX_AGE = 30 * DAY;

// Reads: retry twice, only for connection problems (timeouts, dropped
// connections). A 4xx answer or a bug in our code won't fix itself.
export function shouldRetryRead(failureCount, error) {
  return failureCount < 2 && error?.isConnectionError === true && !error?.isCodeError;
}

// Saves: keep retrying while the failure is a connection problem — a logged
// set must reach the server eventually. Anything else is shown to the user.
// (While the device is offline, mutations pause instead of retrying.)
export function shouldRetrySave(failureCount, error) {
  return error?.isConnectionError === true && !error?.isCodeError;
}

// 1s, 2s, 4s … capped at 30s.
export function retryDelay(attempt) {
  return Math.min(SECOND * 2 ** attempt, 30 * SECOND);
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * SECOND,
        // Must be at least PERSIST_MAX_AGE, or saved copies are dropped from
        // memory (and so from storage) before they expire.
        gcTime: PERSIST_MAX_AGE,
        retry: shouldRetryRead,
        retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: shouldRetrySave,
        retryDelay,
      },
    },
  });
}

export const queryClient = createQueryClient();

// Stored in IndexedDB (localStorage is ~5 MB and blocks the page).
export function createPersister() {
  return createAsyncStoragePersister({
    storage: { getItem: get, setItem: set, removeItem: del },
    key: 'replab-query-cache',
    throttleTime: SECOND,
  });
}

export const persister = createPersister();

export const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE,
  // Changing the buster throws away the whole saved cache — including saves
  // still waiting to sync — so it is NOT the app version. Bump
  // CACHE_SHAPE_VERSION only when a release changes the shape of cached data,
  // and only in a release where losing unsent saves is acceptable.
  buster: CACHE_SHAPE_VERSION,
  dehydrateOptions: {
    // Only successful reads are saved; queries can opt out with
    // meta: { persist: false } (e.g. anything sensitive or huge).
    shouldDehydrateQuery: (query) => query.state.status === 'success' && query.meta?.persist !== false,
    // Unsent saves (paused offline, or still retrying) survive an app restart.
    shouldDehydrateMutation: (mutation) => mutation.state.status === 'pending',
  },
};

// Logout or a different user signing in (api.js clearApiCache): drop every
// query and queued save, in memory and on the device, so the next person
// never sees — or sends — the previous user's data.
export async function clearQueryCache(client = queryClient, p = persister) {
  client.getMutationCache().clear();
  client.clear();
  await p.removeClient();
}
onApiCacheClear(() => { clearQueryCache().catch(() => {}); });

// Saves not yet confirmed by the server (paused offline or retrying).
export function getPendingSaveCount(client = queryClient) {
  return client.getMutationCache().getAll().filter((m) => m.state.status === 'pending').length;
}
