import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { queryClient } from '../queries/queryClient';
import { keys, fetchPath } from '../queries/keys';

// The exercise library is large and rarely changes, so screens share one
// copy for 10 minutes before checking for updates (it's still saved on the
// device and shown offline). Every useExercises() reads the same cache, so
// a favorite toggled on one screen (ExerciseDetail) shows on the others
// (Library, pickers) at once.
const LIBRARY_STALE_MS = 10 * 60 * 1000;
// Only changes to exercises refresh it (not every workout autosave).
const libraryMeta = { refreshOnWritesTo: '/exercises' };
const exercisesQuery = { queryKey: keys.exercises(), queryFn: fetchPath('/exercises'), staleTime: LIBRARY_STALE_MS, meta: libraryMeta };
const musclesQuery = { queryKey: keys.exerciseMuscles(), queryFn: fetchPath('/exercises/muscles'), staleTime: LIBRARY_STALE_MS, meta: libraryMeta };
const EMPTY = [];

// Save / unsave an exercise. Optimistic: the cached list flips immediately
// and rolls back (then rethrows) if the request fails.
export async function setExerciseFavorite(exerciseId, favorite) {
  const flip = (value) => queryClient.setQueryData(keys.exercises(), (list) => (
    list ? list.map((e) => (e.id === exerciseId ? { ...e, isFavorite: value } : e)) : list
  ));
  flip(favorite);
  try {
    // invalidate: false — the list is already right; no need to reload it.
    await api(`/exercises/${exerciseId}/favorite`, { method: favorite ? 'PUT' : 'DELETE', invalidate: false });
  } catch (err) {
    flip(!favorite);
    throw err;
  }
}

function refreshLibrary() {
  return queryClient.invalidateQueries({ queryKey: keys.exercises() });
}

export function useExercises() {
  const exercisesResult = useQuery(exercisesQuery);
  const musclesResult = useQuery(musclesQuery);

  const createCustom = useCallback(async (name, muscleGroup, tags) => {
    const result = await api('/exercises', {
      method: 'POST',
      body: JSON.stringify({ name, muscleGroup, tags }),
    });
    refreshLibrary();
    return result;
  }, []);

  return {
    exercises: exercisesResult.data || EMPTY,
    muscleGroups: musclesResult.data || EMPTY,
    loading: exercisesResult.isPending,
    createCustom,
    invalidateCache: refreshLibrary,
    setFavorite: setExerciseFavorite,
  };
}

/**
 * Get substitutes for an exercise from a cached exercise list.
 * Same scoring algorithm as the old exerciseLibrary.js, but uses API data.
 */
export function getSubstitutesFromList(exerciseName, exercises) {
  const lower = exerciseName.toLowerCase();
  const source = exercises.find(e => e.name.toLowerCase() === lower);

  if (!source) {
    return exercises
      .filter(e => e.name !== exerciseName)
      .sort((a, b) => a.muscle.localeCompare(b.muscle) || a.name.localeCompare(b.name));
  }

  const sourceTags = new Set(source.tags);

  return exercises
    .filter(e => e.name !== exerciseName)
    .map(e => {
      let score = 0;
      if (e.muscle === source.muscle) score += 10;
      for (const tag of e.tags) {
        if (sourceTags.has(tag)) score += 2;
      }
      return { ...e, score };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
