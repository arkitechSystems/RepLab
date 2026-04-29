// Heuristic muscle-group classifier for exercise names. Used by the
// Utilities → Personal Records page and the Progress (progressive
// overload) page so both group exercises identically.
//
// Order matters: more specific muscles are checked first so e.g. a
// "Romanian Deadlift" lands in Hamstrings before the generic "deadlift"
// keyword pulls it into Back.

export const MUSCLE_GROUPS = [
  'Chest', 'Shoulders', 'Traps', 'Biceps', 'Back', 'Triceps', 'Quads', 'Glutes', 'Hamstrings',
];

export const MUSCLE_KEYWORDS = {
  Chest: ['bench press', 'chest', 'fly', 'flye', 'dip', 'push up', 'pushup', 'pec'],
  Shoulders: ['shoulder press', 'overhead press', 'lateral raise', 'front raise', 'face pull', 'delt', 'arnold', 'military press'],
  Traps: ['shrug', 'trap', 'upright row'],
  Biceps: ['curl', 'bicep', 'hammer curl', 'preacher'],
  Back: ['row', 'pulldown', 'pull-up', 'pull up', 'pullup', 'lat', 'deadlift', 'back'],
  Triceps: ['tricep', 'pushdown', 'skull crusher', 'close grip', 'extension', 'kickback'],
  Quads: ['squat', 'leg press', 'leg extension', 'lunge', 'split squat', 'front squat', 'quad'],
  Glutes: ['hip thrust', 'glute', 'bridge', 'kickback'],
  Hamstrings: ['hamstring', 'leg curl', 'romanian deadlift', 'rdl', 'stiff leg', 'nordic'],
};

export const MUSCLE_PRIORITY = ['Hamstrings', 'Glutes', 'Quads', 'Traps', 'Biceps', 'Triceps', 'Shoulders', 'Chest', 'Back'];

export function classifyExercise(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const group of MUSCLE_PRIORITY) {
    if (MUSCLE_KEYWORDS[group].some((kw) => lower.includes(kw))) return group;
  }
  return null;
}
