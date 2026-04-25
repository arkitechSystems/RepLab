// Compute a suggested weight for an exercise set from the user's stored
// one-rep max, when the exercise's description prescribes a percentage
// (e.g. "75% 1RM · Rest 2-3MIN · …" on the Nippard PPL program).
//
// Only the three lifts we actually track 1RMs for are supported:
// bench, squat, deadlift. Everything else returns null.

const LIFT_MAP = {
  // Bench
  'bench press': 'maxBench',
  'barbell bench press': 'maxBench',
  'flat bench press': 'maxBench',

  // Squat
  'squat': 'maxSquat',
  'back squat': 'maxSquat',
  'tempo back squat': 'maxSquat',
  'pause back squat': 'maxSquat',

  // Deadlift
  'deadlift': 'maxDeadlift',
  'conventional deadlift': 'maxDeadlift',
};

function normalizeName(name) {
  return String(name || '').toLowerCase().trim();
}

function getLiftKey(exerciseName) {
  return LIFT_MAP[normalizeName(exerciseName)] || null;
}

// Matches the first "NN%" token in a string. Caps at 30-100 so we don't
// accidentally grab random percentages (e.g. a "50% completion" metric).
function parsePercentage(text) {
  if (!text) return null;
  const match = String(text).match(/(\d{2,3})\s*%/);
  if (!match) return null;
  const pct = Number(match[1]);
  if (pct < 30 || pct > 100) return null;
  return pct / 100;
}

// Round to the nearest multiple of `step` (default 5 lb).
function roundToStep(value, step = 5) {
  return Math.round(value / step) * step;
}

/**
 * Returns the %1RM-derived weight (rounded to 5 lb) or null when the
 * exercise isn't one of the tracked lifts, the user hasn't stored the
 * relevant 1RM, or no percentage is specified.
 */
export function calculateOneRMSuggestion({ exerciseName, description, metrics }) {
  if (!metrics) return null;
  const liftKey = getLiftKey(exerciseName);
  if (!liftKey) return null;
  const oneRM = Number(metrics[liftKey]);
  if (!oneRM || oneRM <= 0) return null;
  const pct = parsePercentage(description);
  if (!pct) return null;
  return roundToStep(oneRM * pct);
}
