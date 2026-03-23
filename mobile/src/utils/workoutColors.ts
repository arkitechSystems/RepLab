interface WorkoutColor {
  hex: string;
  hexLight: string; // 20% opacity version for backgrounds
}

const COLOR_PALETTE: WorkoutColor[] = [
  { hex: '#EF4444', hexLight: 'rgba(239,68,68,0.2)' },   // red
  { hex: '#3B82F6', hexLight: 'rgba(59,130,246,0.2)' },   // blue
  { hex: '#22C55E', hexLight: 'rgba(34,197,94,0.2)' },    // green
  { hex: '#A855F7', hexLight: 'rgba(168,85,247,0.2)' },   // purple
  { hex: '#EAB308', hexLight: 'rgba(234,179,8,0.2)' },    // yellow
  { hex: '#EC4899', hexLight: 'rgba(236,72,153,0.2)' },   // pink
  { hex: '#06B6D4', hexLight: 'rgba(6,182,212,0.2)' },    // cyan
];

const REST_COLOR: WorkoutColor = { hex: '#F97316', hexLight: 'rgba(249,115,22,0.2)' };
const DEFAULT_COLOR = REST_COLOR;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s*\(week\s*\d+\)\s*/gi, '').trim();
}

export function buildProgramColorMap(templates: any[]): Map<string, WorkoutColor> {
  const colorMap = new Map<string, WorkoutColor>();
  let colorIdx = 0;
  for (const t of templates) {
    if (t.isRest) continue;
    const key = normalizeName(t.name);
    if (colorMap.has(key)) continue;
    colorMap.set(key, COLOR_PALETTE[colorIdx % COLOR_PALETTE.length]);
    colorIdx++;
  }
  return colorMap;
}

export function getColorFromMap(colorMap: Map<string, WorkoutColor>, name: string, isRest?: boolean): WorkoutColor {
  if (isRest) return REST_COLOR;
  if (!name) return DEFAULT_COLOR;
  return colorMap.get(normalizeName(name)) || DEFAULT_COLOR;
}

export function getWorkoutColor(name: string): WorkoutColor {
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
