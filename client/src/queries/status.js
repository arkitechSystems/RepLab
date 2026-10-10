// Status hooks for the banners in Layout and per-screen "saved data" notices.
import { useEffect } from 'react';
import { useMutationState, useQuery } from '@tanstack/react-query';
import { markShowingCached, clearShowingCached } from '../api';
import { pathKey, fetchPath } from './keys';

// A screen's data for a GET path, from the shared cache: the saved copy
// shows at once (and offline), the live data replaces it, and the "Showing
// saved data" line appears while an old copy is on screen. `failed` is true
// only when there's nothing to show — a failed refresh keeps the saved copy.
export function useApiQuery(path, { enabled = true, ...options } = {}) {
  const query = useQuery({ queryKey: pathKey(path), queryFn: fetchPath(path), enabled, ...options });
  useSavedDataNotice(`query:${path}`, query);
  return { ...query, failed: query.isError && query.data === undefined };
}

// Saves not yet confirmed by the server (paused offline or retrying) —
// "N changes waiting to sync".
export function usePendingSaveCount() {
  return useMutationState({ filters: { status: 'pending' } }).length;
}

// Shows Layout's "Showing saved data from <time>" line while a screen is
// displaying a restored copy whose refresh hasn't landed. Same rules as
// before the migration: the line appears once the refresh has taken a while
// (Layout waits ~8s), or right away if the refresh failed.
export function useSavedDataNotice(id, query) {
  const { data, isFetching, isError, dataUpdatedAt, isFetchedAfterMount } = query;
  const showingOldCopy = data !== undefined && !isFetchedAfterMount && (isFetching || isError);
  useEffect(() => {
    if (!showingOldCopy) { clearShowingCached(id); return undefined; }
    markShowingCached(id, dataUpdatedAt, { immediate: isError });
    return () => clearShowingCached(id);
  }, [id, showingOldCopy, dataUpdatedAt, isError]);
}
