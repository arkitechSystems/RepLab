// Smart cardio for workout exercise cards.
//
// Any exercise whose library muscle group is "Conditioning" (master or the
// user's custom exercises) logs as cardio instead of weight × reps:
//   • the first (weight) column becomes the machine's main setting —
//     resistance, level, speed or damper (see machineFor);
//   • the reps column becomes a per-set metric chooser: Time (minutes),
//     Distance (miles, or meters on a rower) or Reps (count — bike
//     revolutions count as reps).
//
// Sets are stored as weight = first-column value, reps = 0, with the metric
// and value in session_entries.cardio_metric / cardio_value. reps = 0 keeps
// cardio out of PRs (they need reps > 0) and out of volume (weight × reps).

export const CARDIO_MUSCLE = 'Conditioning';

export const CARDIO_METRICS = ['time', 'distance', 'reps'];
export const DEFAULT_CARDIO_METRIC = 'time';

// First-column config, matched against the exercise name (case-insensitive
// "contains"). `label` is the column header; `short` prefixes logged values
// in summaries ("Lvl 8 · 20 min"); `unit` follows the value instead
// ("6.5 mph"). `none` hides the column entirely.
const MACHINES = [
  { match: ['elliptical', 'stationary bike', 'assault bike', 'air bike', 'spin bike', 'recumbent bike', 'exercise bike'], label: 'Resistance · lvl', short: 'Lvl' },
  { match: ['stairmaster', 'stair master', 'stair climber', 'stepmill', 'incline walk'], label: 'Level · lvl', short: 'Lvl' },
  { match: ['treadmill'], label: 'Speed · mph', unit: 'mph' },
  { match: ['rowing', 'rower', 'erg'], label: 'Damper · 1–10', short: 'Damper', rowing: true },
  { match: ['jogging', 'running', 'jog', 'run'], none: true },
];
const DEFAULT_MACHINE = { label: 'Weight · lb', unit: 'lb' };

export function machineFor(name) {
  const n = String(name || '').toLowerCase();
  return MACHINES.find((m) => m.match.some((w) => n.includes(w))) || DEFAULT_MACHINE;
}

// libraryByName: Map of lowercased exercise name → library exercise (needs .muscle).
export function isCardioExercise(name, libraryByName) {
  const ex = libraryByName?.get(String(name || '').trim().toLowerCase());
  return !!ex && ex.muscle === CARDIO_MUSCLE;
}

export function metricUnit(metric, name) {
  if (metric === 'distance') return machineFor(name).rowing ? 'm' : 'mi';
  if (metric === 'reps') return 'reps';
  return 'min';
}

export const METRIC_LABEL = { time: 'Time', distance: 'Dist', reps: 'Reps' };

export function nextMetric(metric) {
  const i = CARDIO_METRICS.indexOf(metric || DEFAULT_CARDIO_METRIC);
  return CARDIO_METRICS[(i + 1) % CARDIO_METRICS.length];
}

function trimNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100);
}

// "Lvl 8 · 20 min", "6.5 mph · 2.1 mi", "Lvl 5 · 120 reps", or just
// "20 min" when there's no first-column value.
export function formatCardioSet(name, weight, metric, value) {
  const m = machineFor(name);
  const parts = [];
  const w = Number(weight);
  if (!m.none && Number.isFinite(w) && w > 0) {
    parts.push(m.short ? `${m.short} ${trimNum(w)}` : `${trimNum(w)} ${m.unit || ''}`.trim());
  }
  const v = Number(value);
  if (Number.isFinite(v) && v > 0) parts.push(`${trimNum(v)} ${metricUnit(metric || DEFAULT_CARDIO_METRIC, name)}`);
  return parts.join(' · ');
}

// True when a stored/entry set carries a cardio value.
export function hasCardioValue(set) {
  return Number(set?.cardioValue) > 0;
}
