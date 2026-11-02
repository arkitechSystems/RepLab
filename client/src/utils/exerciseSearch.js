// The app's exercise search: the shared module (../../../shared/exerciseSearch.js)
// wired to this package's Fuse.js. See that file for the rules.
import Fuse from 'fuse.js';
import { createExerciseSearch } from '../../../shared/exerciseSearch.js';
import { savedFirst } from './savedExercises';

export { EXERCISE_ABBREVIATIONS, normalizeExerciseText, matchesExerciseQuery } from '../../../shared/exerciseSearch.js';

export const { searchExercises, searchExerciseList } = createExerciseSearch(Fuse);

// Small label shown above spelling-fallback rows in the pickers.
export const CLOSEST_MATCHES_LABEL = 'Closest matches';

// Typing in an exercise picker: unique names, alphabetical within each rank,
// saved exercises floated to the top, capped at `limit` — then the spelling
// fallback rows (marked `isFuzzy: true`) so there are at least 3 to pick from.
export function pickerSearch(list, query, { limit = 8 } = {}) {
  const sorted = [...(list || [])].sort((a, b) => a.name.localeCompare(b.name));
  const { matches, suggestions } = searchExercises(sorted, query, { uniqueNames: true });
  return savedFirst(matches)
    .slice(0, limit)
    .concat(suggestions.map((ex) => ({ ...ex, isFuzzy: true })));
}

// True for the first spelling-fallback row in a list — where the
// "Closest matches" label goes.
export function startsFuzzyGroup(list, index) {
  return !!list[index]?.isFuzzy && !list[index - 1]?.isFuzzy;
}
