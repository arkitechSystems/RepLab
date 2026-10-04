// Helpers for the post-completion "Save to My Workouts?" prompt.

// Structure only: exercise names in order and each exercise's set count.
// Weights, reps and section headers are ignored.
function structureOf(exercises) {
  return (exercises || [])
    .filter((ex) => ex && !ex.isSectionHeader)
    .map((ex) => `${String(ex.name || '').trim().toLowerCase()}#${(ex.sets || []).length}`);
}

// True when the session's workout differs structurally from the original
// workout: exercises added, removed, swapped or reordered, or a set count
// changed.
export function workoutStructureChanged(originalExercises, sessionExercises) {
  const a = structureOf(originalExercises);
  const b = structureOf(sessionExercises);
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}

// Default name for a saved custom workout — same format Start Empty uses:
// "10/4/26 custom workout". `dateStr` is the workout's YYYY-MM-DD date.
export function customWorkoutDefaultName(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  const date = y && m && d ? new Date(y, m - 1, d) : new Date();
  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)} custom workout`;
}
