// Audit the prod master exercise library against a curated list of common
// exercises found in popular programs (PPL, 5x5, Renaissance Periodization,
// Jeff Nippard, Mike Israetel, StrongLifts, Athlean-X, Boostcamp, CrossFit).
// Read-only. Run when planning a library expansion to get a precise punch
// list of what's missing.
//
// Each expected entry has a `canonical` name and an optional `synonyms` array
// — the prod library counts as "has it" if any of the names matches
// case-insensitively. Add new entries here as you discover programs / users
// asking for movements that aren't in the library.
//
// Run: node --env-file=server/.env server/scripts/find-missing-common-exercises.js
import pool from '../dbPool.js';

const EXPECTED = [
  // === Compound push ===
  { canonical: 'Barbell Bench Press', synonyms: ['Bench Press'] },
  { canonical: 'Dumbbell Bench Press' },
  { canonical: 'Incline Bench Press', synonyms: ['Incline barbell bench', 'Incline Barbell Bench Press'] },
  { canonical: 'Incline Dumbbell Press' },
  { canonical: 'Decline Bench Press', synonyms: ['Decline Barbell Bench Press'] },
  { canonical: 'Close-Grip Bench Press' },
  { canonical: 'Push-Ups', synonyms: ['Pushups'] },
  { canonical: 'Chest Dips', synonyms: ['Dips'] },
  { canonical: 'Cable Fly', synonyms: ['Cable Crossover'] },
  { canonical: 'Pec Deck' },
  { canonical: 'Machine Chest Press' },

  // === Compound pull ===
  { canonical: 'Deadlift', synonyms: ['Conventional Deadlift'] },
  { canonical: 'Sumo Deadlift', synonyms: ['Barbell Sumo Deadlift'] },
  { canonical: 'Romanian Deadlift', synonyms: ['RDL', 'Barbell Romanian Deadlift'] },
  { canonical: 'Stiff Leg Deadlift' },
  { canonical: 'Barbell Row', synonyms: ['Bent Over Row', 'Barbell Bent Over Row'] },
  { canonical: 'Pendlay Row' },
  { canonical: 'Dumbbell Row', synonyms: ['Single-Arm Dumbbell Row', 'One-Arm Dumbbell Row', 'Dumbbell One-Arm Row'] },
  { canonical: 'T-Bar Row' },
  { canonical: 'Cable Row', synonyms: ['Cable Rows', 'Seated Cable Row'] },
  { canonical: 'Lat Pulldown' },
  { canonical: 'Pull-Up', synonyms: ['PULL-UP', 'Pull-Ups', 'Pull Ups', 'Pullup'] },
  { canonical: 'Chin-Up', synonyms: ['Chin-Ups', 'Chin Up', 'Chinups'] },
  { canonical: 'Inverted Row' },
  { canonical: 'Meadows Row' },
  { canonical: 'Rack Pull' },
  { canonical: 'Chest-Supported Row' },
  { canonical: 'Face Pulls', synonyms: ['Face Pull'] },

  // === Shoulders ===
  { canonical: 'Overhead Press', synonyms: ['OHP', 'Military Press', 'Standing Press', 'Barbell Shoulder Press'] },
  { canonical: 'Dumbbell Shoulder Press', synonyms: ['Seated Shoulder Press (DB)'] },
  { canonical: 'Arnold Press' },
  { canonical: 'Push Press' },
  { canonical: 'Lateral Raises', synonyms: ['Dumbbell Lateral Raise', 'Side Lateral Raise'] },
  { canonical: 'Cable Lateral Raise' },
  { canonical: 'Front Raise' },
  { canonical: 'Rear Delt Fly', synonyms: ['Reverse Fly'] },
  { canonical: 'Reverse Pec Deck' },
  { canonical: 'Upright Row' },

  // === Biceps ===
  { canonical: 'Barbell Curl', synonyms: ['Barbell Curls'] },
  { canonical: 'Dumbbell Curl', synonyms: ['Bicep Curls'] },
  { canonical: 'EZ Bar Curl' },
  { canonical: 'Hammer Curl', synonyms: ['Hammer Curls', 'Dumbbell Hammer Curl', 'Hammer Curl (DB)'] },
  { canonical: 'Preacher Curl' },
  { canonical: 'Concentration Curl' },
  { canonical: 'Cable Curl' },
  { canonical: 'Bayesian Cable Curl' },
  { canonical: 'Spider Curl' },

  // === Triceps ===
  { canonical: 'Skull Crushers', synonyms: ['Lying Triceps Extension'] },
  { canonical: 'Cable Tricep Pushdown', synonyms: ['Tricep Pushdowns', 'Triceps Pushdown'] },
  { canonical: 'Overhead Triceps Extension', synonyms: ['Overhead Tricep Extension (rope)'] },
  { canonical: 'Tricep Dips' },
  { canonical: 'Tricep Kickback', synonyms: ['Cable Triceps Kickback', 'Cable Tricep Kickbacks (Burnout)', 'Tricep Kickbacks', 'Triceps Kickback'] },
  { canonical: 'JM Press' },
  { canonical: 'Diamond Push-Ups' },

  // === Quads ===
  { canonical: 'Back Squat', synonyms: ['Barbell Squat', 'BB Squats'] },
  { canonical: 'Front Squat' },
  { canonical: 'Goblet Squat' },
  { canonical: 'Hack Squat' },
  { canonical: 'Bulgarian Split Squat', synonyms: ['Bulgarian Split Squats'] },
  { canonical: 'Box Squat' },
  { canonical: 'Belt Squat' },
  { canonical: 'Leg Press' },
  { canonical: 'Leg Extension', synonyms: ['Leg Extensions'] },
  { canonical: 'Walking Lunges', synonyms: ['Walking Lunge', 'Dumbbell Walking Lunge', 'DB Walking Lunges'] },
  { canonical: 'Reverse Lunges' },
  { canonical: 'Step-Ups', synonyms: ['Dumbbell Step-Ups'] },

  // === Hamstrings / Posterior chain ===
  { canonical: 'Leg Curl', synonyms: ['Leg Curls'] },
  { canonical: 'Seated Leg Curl' },
  { canonical: 'Nordic Hamstring Curl' },
  { canonical: 'Glute-Ham Raise', synonyms: ['GHR'] },
  { canonical: 'Good Morning' },
  { canonical: 'Cable Pull-Through' },

  // === Glutes ===
  { canonical: 'Barbell Hip Thrust', synonyms: ['Hip Thrust'] },
  { canonical: 'Single-Leg Hip Thrust' },
  { canonical: 'Glute Bridge' },
  { canonical: 'Hip Abduction' },
  { canonical: 'Hip Adduction' },

  // === Calves ===
  { canonical: 'Standing Calf Raise', synonyms: ['Standing Calf Raises', 'Calf Raises'] },
  { canonical: 'Seated Calf Raise' },
  { canonical: 'Donkey Calf Raise' },
  { canonical: 'Tibialis Raise' },

  // === Traps / Carries ===
  { canonical: 'Barbell Shrugs', synonyms: ['Barbell Shrug'] },
  { canonical: 'Dumbbell Shrugs', synonyms: ['Dumbbell Shrug'] },
  { canonical: "Farmer's Carry", synonyms: ["Farmers Carry", "Farmer's Walk"] },
  { canonical: 'Suitcase Carry' },

  // === Core ===
  { canonical: 'Plank', synonyms: ['Planks'] },
  { canonical: 'Side Plank' },
  { canonical: 'Cable Crunch' },
  { canonical: 'Ab Rollout', synonyms: ['Ab Wheel Rollout'] },
  { canonical: 'Hanging Leg Raises', synonyms: ['Hanging Leg Raise', 'Leg Raises'] },
  { canonical: 'Pallof Press' },
  { canonical: 'V-Ups' },
  { canonical: 'Cable Woodchopper' },
  { canonical: 'Decline Sit-Up' },
  { canonical: 'Russian Twist' },
  { canonical: 'Dead Bug' },
  { canonical: 'Bicycle Crunches', synonyms: ['Bicycle Crunch'] },
  { canonical: 'Mountain Climbers' },

  // === Olympic lifts ===
  { canonical: 'Power Clean' },
  { canonical: 'Hang Clean' },
  { canonical: 'Clean & Jerk' },
  { canonical: 'Hang Snatch' },
  { canonical: 'High Pull' },

  // === Kettlebell ===
  { canonical: 'Kettlebell Swing', synonyms: ['KB Swing'] },
  { canonical: 'Turkish Get-Up' },
  { canonical: 'Kettlebell Snatch', synonyms: ['KB Snatch'] },
  { canonical: 'Kettlebell Clean', synonyms: ['KB Clean'] },

  // === Conditioning / Cardio ===
  { canonical: 'Treadmill' },
  { canonical: 'Stationary Bike', synonyms: ['Bike', 'Exercise Bike', 'Cycling'] },
  { canonical: 'Elliptical' },
  { canonical: 'Rowing Machine', synonyms: ['Rower'] },
  { canonical: 'Jump Rope' },
  { canonical: 'Sled Push' },
  { canonical: 'Sled Drag' },
  { canonical: 'Burpees', synonyms: ['Burpee'] },
  { canonical: 'Wall Balls', synonyms: ['Wall Ball'] },
  { canonical: 'Box Jumps', synonyms: ['Box Jump'] },
  { canonical: 'Battle Ropes' },
];

const { rows } = await pool.query(
  "SELECT LOWER(name) AS name FROM exercises WHERE created_by IS NULL"
);
const present = new Set(rows.map((r) => r.name));

const found = [];
const missing = [];
for (const ex of EXPECTED) {
  const candidates = [ex.canonical, ...(ex.synonyms || [])];
  const hit = candidates.find((n) => present.has(n.toLowerCase()));
  if (hit) {
    found.push({ canonical: ex.canonical, matchedAs: hit });
  } else {
    missing.push(ex.canonical);
  }
}

console.log(`Master library has ${present.size} exercises.`);
console.log(`Curated expected list:    ${EXPECTED.length}`);
console.log(`Found (exact or synonym): ${found.length}`);
console.log(`Missing:                  ${missing.length}`);

if (missing.length) {
  console.log('\n--- Missing from prod ---');
  missing.forEach((n) => console.log('  - ' + n));
}

// Highlight any cases where prod has the synonym but not the canonical —
// might want to rename later for consistency.
const renamedHits = found.filter((f) => f.matchedAs.toLowerCase() !== f.canonical.toLowerCase());
if (renamedHits.length) {
  console.log('\n--- Found via synonym (prod name differs from curated canonical) ---');
  renamedHits.forEach((f) => console.log(`  · ${f.canonical}  →  prod has "${f.matchedAs}"`));
}

process.exit(0);
