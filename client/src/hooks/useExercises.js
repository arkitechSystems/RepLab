import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

// In-memory cache — survives re-renders, cleared on page reload
let exerciseCache = null;
let muscleGroupCache = null;
// Every mounted useExercises() instance, so a favorite toggle on one screen
// (ExerciseDetail) shows up on the others (Library, pickers) without a refetch.
const listeners = new Set();

function publish(next) {
  exerciseCache = next;
  for (const fn of listeners) fn(next);
}

// Save / unsave an exercise. Optimistic: the cache flips immediately and
// rolls back (then rethrows) if the request fails.
export async function setExerciseFavorite(exerciseId, favorite) {
  const flip = (list, value) => (list || []).map((e) => (e.id === exerciseId ? { ...e, isFavorite: value } : e));
  if (exerciseCache) publish(flip(exerciseCache, favorite));
  try {
    await api(`/exercises/${exerciseId}/favorite`, { method: favorite ? 'PUT' : 'DELETE' });
  } catch (err) {
    if (exerciseCache) publish(flip(exerciseCache, !favorite));
    throw err;
  }
}

export function useExercises() {
  const [exercises, setExercises] = useState(exerciseCache || []);
  const [muscleGroups, setMuscleGroups] = useState(muscleGroupCache || []);

  const [loading, setLoading] = useState(!exerciseCache);

  useEffect(() => {
    listeners.add(setExercises);
    return () => { listeners.delete(setExercises); };
  }, []);

  useEffect(() => {
    if (exerciseCache) return;
    setLoading(true);
    Promise.all([
      api('/exercises'),
      api('/exercises/muscles'),
    ]).then(([exs, muscles]) => {
      muscleGroupCache = muscles;
      publish(exs);
      setMuscleGroups(muscles);
    }).catch((err) => { if (import.meta.env.DEV) console.error(err); })
    .finally(() => setLoading(false));
  }, []);

  const createCustom = useCallback(async (name, muscleGroup, tags) => {
    const result = await api('/exercises', {
      method: 'POST',
      body: JSON.stringify({ name, muscleGroup, tags }),
    });
    // Invalidate cache so next mount re-fetches
    exerciseCache = null;
    muscleGroupCache = null;
    return result;
  }, []);

  const invalidateCache = useCallback(() => {
    exerciseCache = null;
    muscleGroupCache = null;
  }, []);

  return { exercises, muscleGroups, loading, createCustom, invalidateCache, setFavorite: setExerciseFavorite };
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
