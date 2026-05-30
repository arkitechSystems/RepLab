/**
 * Exercise data registry.
 *
 * HOW TO ADD A NEW EXERCISE:
 * 1. Create a new file in this folder (e.g. flatBenchPress.js)
 * 2. Copy the structure from inclineBenchPress.js
 * 3. Import and add it to EXERCISES below
 * 4. The dynamic route /exercises/:slug already handles it.
 *
 * Exercises listed in EXERCISES have hand-authored detail data (instructions,
 * form tips, common mistakes, muscle-activation percentages, optional anatomy
 * figure). When a slug isn't in this map, ExerciseDetail falls back to a
 * MINIMAL exercise object built from the master library row (just name +
 * muscle group + videoId + tags) so every exercise in the master library
 * still routes to a working detail page — sections collapse cleanly when
 * their data isn't present.
 */

import inclineBenchPress from './inclineBenchPress.js';
import barbellBenchPress from './barbellBenchPress.js';
import barbellBackSquat from './barbellBackSquat.js';
import conventionalDeadlift from './conventionalDeadlift.js';
import standingOverheadPress from './standingOverheadPress.js';
import pullUp from './pullUp.js';
import barbellRow from './barbellRow.js';
import romanianDeadlift from './romanianDeadlift.js';
import dumbbellLateralRaise from './dumbbellLateralRaise.js';
import bulgarianSplitSquat from './bulgarianSplitSquat.js';
import cableTricepPushdown from './cableTricepPushdown.js';

// slug → exercise data
const EXERCISES = {
  'incline-bench-press': inclineBenchPress,
  'barbell-bench-press': barbellBenchPress,
  'barbell-back-squat': barbellBackSquat,
  'conventional-deadlift': conventionalDeadlift,
  'standing-overhead-press': standingOverheadPress,
  'pull-up': pullUp,
  'barbell-row': barbellRow,
  'romanian-deadlift': romanianDeadlift,
  'dumbbell-lateral-raise': dumbbellLateralRaise,
  'bulgarian-split-squat': bulgarianSplitSquat,
  'cable-tricep-pushdown': cableTricepPushdown,
};

/** URL-safe slug from any string (used for the fallback path) */
export function slugify(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Look up hand-authored exercise data by URL slug. null if not authored. */
export function getExerciseBySlug(slug) {
  return EXERCISES[slug] || null;
}

/**
 * Find a master-library row whose slugified name matches the given URL slug.
 * Used by ExerciseDetail to build a minimal exercise object when no static
 * data file exists for the slug.
 */
export function findMasterExerciseBySlug(slug, masterExercises) {
  if (!Array.isArray(masterExercises) || !slug) return null;
  return masterExercises.find((ex) => slugify(ex.name) === slug) || null;
}

/**
 * Build a minimal exercise object from a master library row. The detail
 * page renders sections conditionally on data presence, so a minimal
 * exercise just shows the hero + the category eyebrow; instructions /
 * form tips / common mistakes / muscle-activation sections collapse.
 */
export function buildMinimalExercise(libRow) {
  if (!libRow) return null;
  return {
    slug: slugify(libRow.name),
    name: libRow.name,
    category: libRow.muscle || libRow.muscle_group || '',
    videoId: libRow.videoId || libRow.video_id || null,
    primaryMuscles: libRow.muscle ? [libRow.muscle] : [],
    secondaryMuscles: [],
  };
}

/** Get all hand-authored detail-page exercises (the static registry) */
export function getAllDetailExercises() {
  return Object.values(EXERCISES);
}

/**
 * Map of exercise.name → detail URL, for static (hand-authored) exercises only.
 * The Exercise Library uses this AND a slugify-fallback so every row is tappable.
 * (Previously this was the gating mechanism: only exercises in this map were
 * clickable; now every library row routes to /exercises/{slug}.)
 */
export function getDetailSlugs() {
  const map = {};
  for (const ex of Object.values(EXERCISES)) {
    if (ex.name) map[ex.name] = `/exercises/${ex.slug}`;
  }
  return map;
}

export default EXERCISES;
