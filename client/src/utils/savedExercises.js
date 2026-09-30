// Helpers for the user's saved (bookmarked) exercises in the exercise
// pickers. `isFavorite` comes from GET /exercises (see useExercises).

// Saved exercises, one per name, alphabetical — the "Saved" section shown at
// the top of a picker when the search box is empty.
export function savedExercises(list) {
  const seen = new Set();
  return (list || [])
    .filter((ex) => {
      if (!ex.isFavorite || seen.has(ex.name)) return false;
      seen.add(ex.name);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Stable re-order that floats saved exercises to the top of search results
// while keeping the existing ranking within each half.
export function savedFirst(list) {
  return [...(list || [])].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
}
