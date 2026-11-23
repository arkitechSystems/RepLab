// Builds a dated session's independent workout_data copy from a template
// (POST /sessions/initialize → ensureSessionCopy). Pure, so it's unit-tested
// directly (tests/sessionCopy.test.js).
//
// Planned reps / suggested weight: for each exercise, the greater-by-volume
// of the user's last completed performance vs their all-time volume PR
// (db.getVolumeGoalsByExerciseName, matched by exercise NAME), else the
// template's own values.
//
// Goals (2026-11-22): on a workout the user built themselves (template
// user_id = the user — My Workouts, Create a Workout, Edit Workout), the
// weight and reps they saved on it are the plan. Each set's template weight
// and reps become its goalWeight / goalReps (shown in the session's Goal Wt /
// Goal Reps columns) and its planned reps / pre-filled weight. A weight of 0
// (bodyweight / not set) gives no weight goal; the reps goal still applies.
// Library / global templates (user_id NULL) keep the last-performance goals.
// Goals already on a set are never overwritten.
export function buildSessionWorkoutData(tmpl, volumeGoals, userId) {
  const ownTemplate = tmpl.userId != null && tmpl.userId === userId;
  return {
    name: tmpl.name,
    exercises: (tmpl.exercises || []).map((ex) => {
      if (ex.isSectionHeader) {
        return { name: ex.name, setType: ex.setType || 'straight', isSectionHeader: true, sectionNotes: ex.sectionNotes || '', sets: ex.sets || [] };
      }
      const exSetType = ex.setType || 'straight';
      const goal = volumeGoals?.[ex.name];
      return {
        name: ex.name,
        setType: exSetType,
        ...(ex.exerciseDescription ? { exerciseDescription: ex.exerciseDescription } : {}),
        ...(ex.supersetLabel ? { supersetLabel: ex.supersetLabel } : {}),
        sets: (ex.sets || []).map((s) => {
          const out = {
            setNumber: s.setNumber,
            plannedReps: goal ? goal.reps : (s.plannedReps ?? 10),
            suggestedWeight: goal ? goal.weight : (s.suggestedWeight ?? 0),
            setType: s.setType || exSetType,
          };
          if (s.goalWeight != null) out.goalWeight = s.goalWeight;
          if (s.goalReps != null) out.goalReps = s.goalReps;
          if (ownTemplate) {
            const tWeight = Number(s.suggestedWeight);
            const tReps = Number(s.plannedReps);
            if (out.goalWeight == null && tWeight > 0) {
              out.goalWeight = tWeight;
              out.suggestedWeight = tWeight;
            }
            if (out.goalReps == null && tReps > 0) {
              out.goalReps = tReps;
              out.plannedReps = tReps;
            }
          }
          return out;
        }),
      };
    }),
  };
}

// Blank entries (weight 0, reps 0) so the session row exists in the DB.
export function blankEntriesFor(tmpl) {
  const entries = [];
  for (const ex of tmpl.exercises || []) {
    for (const s of ex.sets || []) {
      entries.push({ exerciseName: ex.name, setNumber: s.setNumber, weight: 0, reps: 0 });
    }
  }
  return entries;
}
