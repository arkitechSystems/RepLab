/**
 * Exercise data registry.
 *
 * HOW TO ADD A NEW EXERCISE:
 * 1. Create a new file in this folder (e.g. flatBenchPress.js)
 * 2. Copy the structure from inclineBenchPress.js
 * 3. Import and add it to EXERCISES below
 * 4. Add a route in App.jsx:  <Route path="/exercises/:slug" .../>
 *    (already handled by the dynamic route)
 */

import inclineBenchPress from './inclineBenchPress.js';

// slug → exercise data
const EXERCISES = {
  'incline-bench-press': inclineBenchPress,
};

/** Look up exercise data by URL slug */
export function getExerciseBySlug(slug) {
  return EXERCISES[slug] || null;
}

/** Get all exercises that have detail pages */
export function getAllDetailExercises() {
  return Object.values(EXERCISES);
}

/** Get all slugs (for the library to know which rows are tappable) */
export function getDetailSlugs() {
  const map = {};
  for (const ex of Object.values(EXERCISES)) {
    map[ex.name] = `/exercises/${ex.slug}`;
  }
  return map;
}

export default EXERCISES;
