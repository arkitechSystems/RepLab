// The app's one TanStack Query client: loading, caching, retries and offline
// saving for every converted screen. Decisions behind these settings are in
// docs/tanstack-query-migration.md.
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { onApiCacheClear, onApiWrite, setRetryingCount, reportConnectionFailure } from '../api';

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
        // memory (and so from storage) before they expire. Infinity, not
        // PERSIST_MAX_AGE: 30 days is past setTimeout's limit (~24.8 days),
        // which wraps around and drops every unwatched query the moment it
        // loads. PERSIST_MAX_AGE still expires old saved copies at restore.
        gcTime: Infinity,
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

// Any change saved through api(), from any screen: mark every cached read
// stale. Screens on screen refetch now; the rest refetch when next shown.
// Broad on purpose — one save can touch the schedule, sessions, PRs and
// templates at once, and a missed refresh would show old data.
onApiWrite(() => { queryClient.invalidateQueries(); });

// Connection banner (Layout, via api.js): "Slow connection — still trying…"
// while a load or save is retrying after a connection failure, and "Couldn't
// reach RepLab" once a load has used up its retries. Same wording and timing
// users saw before the migration. Saves paused because the device is offline
// don't count — the offline banner covers those.
export function watchConnectionStatus(client = queryClient) {
  const recount = () => {
    const retryingQueries = client.getQueryCache().getAll()
      .filter((q) => q.state.fetchStatus === 'fetching' && q.state.fetchFailureCount > 0).length;
    const retryingSaves = client.getMutationCache().getAll()
      .filter((m) => m.state.status === 'pending' && !m.state.isPaused && m.state.failureCount > 0).length;
    setRetryingCount(retryingQueries + retryingSaves);
  };
  const unsubQueries = client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action?.type === 'error' && event.action.error?.isConnectionError) {
      reportConnectionFailure();
    }
    recount();
  });
  const unsubMutations = client.getMutationCache().subscribe(recount);
  return () => { unsubQueries(); unsubMutations(); };
}
watchConnectionStatus();

// Saves not yet confirmed by the server (paused offline or retrying).
export function getPendingSaveCount(client = queryClient) {
  return client.getMutationCache().getAll().filter((m) => m.state.status === 'pending').length;
}
