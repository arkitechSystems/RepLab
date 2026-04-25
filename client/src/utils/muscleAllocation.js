// Map an exercise name to a muscle group when the exercise object doesn't
// already carry an `ex.muscle`. Heuristic ported from
// server/migrations/add-nippard-push-pull-legs.js — kept in sync intentionally
// (keep both updated when adding new exercise types).
export function inferMuscle(name) {
  if (!name) return 'Other';
  const n = String(name).toUpperCase();
  if (/\bCALF|CALVES\b/.test(n)) return 'Calves';
  if (/\bLEG CURL|HAMSTRING|ROMANIAN|RDL\b/.test(n)) return 'Hamstrings';
  if (/\bHIP THRUST|\bGLUTE|PULL[- ]THROUGH|PULLTHROUGH|LATERAL BAND WALK\b/.test(n)) return 'Glutes';
  if (/\bSQUAT|LUNGE|LEG EXTENSION|LEG PRESS|GOBLET\b/.test(n)) return 'Quads';
  if (/\bDEADLIFT\b/.test(n)) return 'Hamstrings';
  if (/\bSHRUG\b/.test(n)) return 'Traps';
  if (/\bCURL\b/.test(n)) return 'Biceps';
  if (/\bSKULL|TRICEPS|KICKBACK|PRESSDOWN|ROPE OVERHEAD|CLOSE.GRIP\b/.test(n)) return 'Triceps';
  if (/\bDIP\b/.test(n)) return 'Triceps';
  if (/\bSHOULDER PRESS|MILITARY|ARNOLD|LATERAL RAISE|UPRIGHT ROW|FACE PULL|REVERSE FLYE|REVERSE PEC|EGYPTIAN\b/.test(n)) return 'Shoulders';
  if (/\bBENCH PRESS|CHEST|PEC DECK|FLYE|FLY\b/.test(n)) return 'Chest';
  if (/\bROW|PULL-?UP|PULLDOWN|LAT PULL|PULL-OVER|T[- ]BAR|SEAL ROW\b/.test(n)) return 'Back';
  if (/\bHYPEREXTENSION\b/.test(n)) return 'Back';
  if (/\bCRUNCH|PLANK|ROLLOUT|LEG RAISE|BICYCLE\b/.test(n)) return 'Core';
  return 'Other';
}

// Stable color per muscle group. Used by both the segmented progress ring and
// the body heatmap so the legend, ring slices, and anatomical highlights all
// agree.
export const MUSCLE_COLORS = {
  Chest: '#ef4444',
  Back: '#3b82f6',
  Shoulders: '#f97316',
  Biceps: '#a855f7',
  Triceps: '#ec4899',
  Quads: '#22c55e',
  Hamstrings: '#14b8a6',
  Glutes: '#eab308',
  Calves: '#84cc16',
  Core: '#06b6d4',
  Forearms: '#6366f1',
  Traps: '#f59e0b',
  Other: '#6b7280',
};

// Build per-muscle work share from completed sets.
//   exercises:     template.exercises (the list as rendered in the session)
//   entries:       Record<exerciseKey, Array<{weight, reps, ...}>>
//   completedSets: Set<string> — "exerciseKey-setIdx" for each completed set
//   exKey:         the same exKey() helper WorkoutSession uses (handles dupes)
//
// Returns an array of { muscle, share, count, color } sorted by share desc,
// where share is 0..1 and sums to ~1. Returns [] if no sets were completed.
export function buildMuscleAllocation({ exercises, entries, completedSets, exKey }) {
  const counts = {};
  let total = 0;
  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const ex = exercises[exIdx];
    if (ex.isSectionHeader) continue;
    const muscle = ex.muscle || inferMuscle(ex.name);
    const key = exKey(exercises, ex, exIdx);
    const setCount = ex.sets?.length || 0;
    let completed = 0;
    for (let i = 0; i < setCount; i++) {
      if (completedSets?.has(`${key}-${i}`)) completed++;
    }
    if (completed > 0) {
      counts[muscle] = (counts[muscle] || 0) + completed;
      total += completed;
    }
  }
  if (total === 0) return [];
  return Object.entries(counts)
    .map(([muscle, count]) => ({
      muscle,
      count,
      share: count / total,
      color: MUSCLE_COLORS[muscle] || MUSCLE_COLORS.Other,
    }))
    .sort((a, b) => b.share - a.share);
}
