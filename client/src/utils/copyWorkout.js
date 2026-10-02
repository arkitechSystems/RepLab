// Calendar "Copy Workout": builds the target day's workout_data from the
// source day's session. Pure (no React / API) so it can be tested directly.
//
// Every copy carries the source's logged weights forward as suggested
// weights. With useReps ("Yes, Use Reps"), each set also gets the source's
// logged weight and reps as its goal (goalWeight / goalReps), which the
// session screen shows in the Goal Wt / Goal Reps columns, and plannedReps
// becomes the logged reps.
//
// Logged sets are matched per exercise name in set order and consumed in
// sequence (same as WorkoutSession's loader), so an exercise that appears
// twice in a workout maps each occurrence to its own sets.
export function buildCopiedWorkoutData(sourceWorkoutData, sourceEntries, useReps) {
  const workoutData = { ...sourceWorkoutData };
  if (!workoutData.exercises || !sourceEntries) return workoutData;

  const loggedByName = new Map();
  for (const e of sourceEntries) {
    if (!loggedByName.has(e.exerciseName)) loggedByName.set(e.exerciseName, []);
    loggedByName.get(e.exerciseName).push(e);
  }
  for (const list of loggedByName.values()) list.sort((a, b) => a.setNumber - b.setNumber);

  const consumed = {};
  workoutData.exercises = workoutData.exercises.map((ex) => {
    if (ex.isSectionHeader) return ex;
    const start = consumed[ex.name] || 0;
    consumed[ex.name] = start + ex.sets.length;
    const mine = (loggedByName.get(ex.name) || []).slice(start, start + ex.sets.length);
    return {
      ...ex,
      sets: ex.sets.map((s, i) => {
        const logged = mine[i];
        const loggedWeight = logged && Number(logged.weight) > 0 ? Number(logged.weight) : null;
        const loggedReps = logged && Number(logged.reps) > 0 ? Number(logged.reps) : null;
        // Drop goals carried in the source snapshot; "Use Reps" sets fresh
        // ones from what was actually logged.
        const { goalWeight: _gw, goalReps: _gr, ...rest } = s;
        return {
          ...rest,
          plannedReps: useReps && loggedReps != null ? loggedReps : s.plannedReps,
          suggestedWeight: loggedWeight != null ? loggedWeight : s.suggestedWeight,
          ...(useReps && loggedWeight != null ? { goalWeight: loggedWeight } : {}),
          ...(useReps && loggedReps != null ? { goalReps: loggedReps } : {}),
        };
      }),
    };
  });
  return workoutData;
}

// Session load: per-set goals saved in workout_data (goalWeight / goalReps)
// as WorkoutSession's goalOverrides shape: { [exerciseKey]: [{ weight, reps }
// | undefined, ...] }. keyFor(exercises, ex, idx) is WorkoutSession's exKey.
export function goalsFromWorkoutData(exercises, keyFor) {
  const goals = {};
  (exercises || []).forEach((ex, exIdx) => {
    if (ex.isSectionHeader || !ex.sets) return;
    if (!ex.sets.some((s) => s?.goalWeight != null || s?.goalReps != null)) return;
    goals[keyFor(exercises, ex, exIdx)] = ex.sets.map((s) => {
      if (s?.goalWeight == null && s?.goalReps == null) return undefined;
      return {
        ...(s.goalWeight != null ? { weight: String(s.goalWeight) } : {}),
        ...(s.goalReps != null ? { reps: String(s.goalReps) } : {}),
      };
    });
  });
  return goals;
}
