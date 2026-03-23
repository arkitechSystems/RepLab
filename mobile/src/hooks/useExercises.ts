import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface Exercise {
  id: number;
  name: string;
  muscle: string;
  tags: string[];
  isCustom?: boolean;
}

let exerciseCache: Exercise[] | null = null;
let muscleGroupCache: string[] | null = null;

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>(exerciseCache || []);
  const [muscleGroups, setMuscleGroups] = useState<string[]>(muscleGroupCache || []);
  const [loading, setLoading] = useState(!exerciseCache);

  useEffect(() => {
    if (exerciseCache) return;
    setLoading(true);
    Promise.all([api('/exercises'), api('/exercises/muscles')])
      .then(([exs, muscles]) => {
        exerciseCache = exs;
        muscleGroupCache = muscles;
        setExercises(exs);
        setMuscleGroups(muscles);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const createCustom = useCallback(async (name: string, muscleGroup: string, tags?: string[]) => {
    const result = await api('/exercises', {
      method: 'POST',
      body: JSON.stringify({ name, muscleGroup, tags }),
    });
    exerciseCache = null;
    muscleGroupCache = null;
    return result;
  }, []);

  const invalidateCache = useCallback(() => {
    exerciseCache = null;
    muscleGroupCache = null;
  }, []);

  return { exercises, muscleGroups, loading, createCustom, invalidateCache };
}

export function getSubstitutesFromList(exerciseName: string, exercises: Exercise[]): Exercise[] {
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
    .sort((a: any, b: any) => b.score - a.score || a.name.localeCompare(b.name));
}
