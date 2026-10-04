// Heuristic muscle-group classifier for exercise names. Used by the
// Utilities → Personal Records page and the Progress (progressive
// overload) page so both group exercises identically.
//
// Order matters: more specific muscles are checked first so e.g. a
// "Romanian Deadlift" lands in Hamstrings before the generic "deadlift"
// keyword pulls it into Back.

export const MUSCLE_GROUPS = [
  'Chest', 'Shoulders', 'Traps', 'Biceps', 'Forearms', 'Back', 'Triceps', 'Quads', 'Glutes', 'Hamstrings', 'Adductors',
];

export const MUSCLE_KEYWORDS = {
  Chest: ['bench press', 'chest', 'fly', 'flye', 'dip', 'push up', 'pushup', 'pec'],
  Shoulders: ['shoulder press', 'overhead press', 'lateral raise', 'front raise', 'face pull', 'delt', 'arnold', 'military press'],
  Traps: ['shrug', 'trap', 'upright row'],
  Biceps: ['curl', 'bicep', 'hammer curl', 'preacher'],
  Back: ['row', 'pulldown', 'pull-up', 'pull up', 'pullup', 'lat', 'deadlift', 'back'],
  Triceps: ['tricep', 'pushdown', 'skull crusher', 'close grip', 'extension', 'kickback'],
  // Hip flexor work lives in Quads and abduction in Glutes, matching the
  // exercise library (the old "Hips" group was retired 2026-09-28).
  Quads: ['squat', 'leg press', 'leg extension', 'lunge', 'split squat', 'front squat', 'quad', 'hip flexor'],
  Glutes: ['hip thrust', 'glute', 'bridge', 'kickback', 'abduction', 'hip extension', 'hip raise'],
  Hamstrings: ['hamstring', 'leg curl', 'romanian deadlift', 'rdl', 'stiff leg', 'nordic'],
  Adductors: ['adduction', 'adductor'],
  Forearms: ['wrist curl', 'wrist roller', 'dead hang', 'forearm', 'plate pinch', 'gripper', 'farmer'],
};

// Forearms first so "Barbell Wrist Curl" isn't pulled into Biceps by "curl";
// Adductors ahead of Glutes/Quads so "Cable Hip Adduction" isn't pulled into
// another group by a broader keyword.
export const MUSCLE_PRIORITY = ['Forearms', 'Hamstrings', 'Adductors', 'Quads', 'Glutes', 'Traps', 'Biceps', 'Triceps', 'Shoulders', 'Chest', 'Back'];

export function classifyExercise(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const group of MUSCLE_PRIORITY) {
    if (MUSCLE_KEYWORDS[group].some((kw) => lower.includes(kw))) return group;
  }
  return null;
}
