// Status hooks for the banners in Layout and per-screen "saved data" notices.
import { useEffect } from 'react';
import { useMutationState } from '@tanstack/react-query';
import { markShowingCached, clearShowingCached } from '../api';

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
