// Ordered color palette for assigning to workouts
const COLOR_PALETTE = [
  { border: 'border-l-wf-red',    text: 'text-wf-red',    bg: 'bg-wf-red/20',    dot: 'bg-wf-red',    hex: '#EF4444' },
  { border: 'border-l-wf-blue',   text: 'text-wf-blue',   bg: 'bg-wf-blue/20',   dot: 'bg-wf-blue',   hex: '#3B82F6' },
  { border: 'border-l-wf-green',  text: 'text-wf-green',  bg: 'bg-wf-green/20',  dot: 'bg-wf-green',  hex: '#22C55E' },
  { border: 'border-l-wf-purple', text: 'text-wf-purple', bg: 'bg-wf-purple/20', dot: 'bg-wf-purple', hex: '#A855F7' },
  { border: 'border-l-wf-yellow', text: 'text-wf-yellow', bg: 'bg-wf-yellow/20', dot: 'bg-wf-yellow', hex: '#EAB308' },
  { border: 'border-l-wf-pink',   text: 'text-wf-pink',   bg: 'bg-wf-pink/20',   dot: 'bg-wf-pink',   hex: '#EC4899' },
  { border: 'border-l-wf-cyan',   text: 'text-wf-cyan',   bg: 'bg-wf-cyan/20',   dot: 'bg-wf-cyan',   hex: '#06B6D4' },
];

const REST_COLOR = { border: 'border-l-wf-orange', text: 'text-wf-orange', bg: 'bg-wf-orange/20', dot: 'bg-wf-orange', hex: '#F97316' };
const DEFAULT_COLOR = REST_COLOR;

// Strip week/day suffixes to get the base workout name
// "Push (Week 3)" -> "push", "Will's Pull 2" -> "will's pull 2"
function normalizeName(name) {
  return name.toLowerCase().replace(/\s*\(week\s*\d+\)\s*/gi, '').trim();
}

/**
 * Build a color map from a program's templates.
 * Iterates through templates in order, assigning colors to each unique
 * non-rest workout name. Once a name repeats (cycle ends), no new colors
 * are assigned — repeated names reuse their already-assigned color.
 * Returns a Map of normalized-name -> color object.
 */
export function buildProgramColorMap(templates) {
  const colorMap = new Map();
  let colorIdx = 0;

  for (const t of templates) {
    if (t.isRest) continue;
    const key = normalizeName(t.name);
    if (colorMap.has(key)) continue; // already assigned
    colorMap.set(key, COLOR_PALETTE[colorIdx % COLOR_PALETTE.length]);
    colorIdx++;
  }

  return colorMap;
}

/**
 * Get a workout's color from a pre-built color map.
 * Falls back to rest color for rest days, or default if not in map.
 */
export function getColorFromMap(colorMap, name, isRest) {
  if (isRest) return REST_COLOR;
  if (!name) return DEFAULT_COLOR;
  const key = normalizeName(name);
  return colorMap.get(key) || DEFAULT_COLOR;
}

/**
 * Standalone color lookup (used outside of program context, e.g. Calendar/History).
 * Uses a simple hash of the normalized name to pick a consistent color
 * from the palette so the same workout name always gets the same color.
 */
export function getWorkoutColor(name) {
  if (!name) return DEFAULT_COLOR;
  const lower = name.toLowerCase().trim();
  if (lower === 'rest' || lower.startsWith('rest')) return REST_COLOR;
  const key = normalizeName(name);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}
