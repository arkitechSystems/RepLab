// One-off: add commonly-requested exercises to the master library that were
// missing from the post-Path-A audit. Olympic lifts, kettlebell work,
// conditioning, and a handful of foundational misses. Idempotent — case-
// insensitive name check before each insert; safe to re-run.
//
// Run: node --env-file=server/.env server/scripts/add-common-exercises.js
import pool from '../dbPool.js';

const NEW_EXERCISES = [
  // === OLYMPIC LIFTS ===
  { name: 'Power Clean',                muscle: 'Back',       tags: ['olympic', 'compound', 'barbell', 'pull', 'power', 'explosive'] },
  { name: 'Hang Clean',                 muscle: 'Back',       tags: ['olympic', 'compound', 'barbell', 'pull', 'power', 'explosive', 'hang'] },
  { name: 'Clean & Jerk',               muscle: 'Shoulders',  tags: ['olympic', 'compound', 'barbell', 'overhead', 'power', 'explosive'] },
  { name: 'Hang Snatch',                muscle: 'Shoulders',  tags: ['olympic', 'compound', 'barbell', 'overhead', 'power', 'explosive', 'hang'] },
  { name: 'High Pull',                  muscle: 'Back',       tags: ['olympic', 'compound', 'barbell', 'pull', 'explosive'] },

  // === CARDIO ===
  { name: 'Stationary Bike',            muscle: 'Cardio',     tags: ['cardio', 'low-impact', 'machine', 'bike'] },
  { name: 'Elliptical',                 muscle: 'Cardio',     tags: ['cardio', 'low-impact', 'machine'] },
  { name: 'Jump Rope',                  muscle: 'Cardio',     tags: ['cardio', 'plyometric', 'bodyweight'] },
  { name: 'Sled Push',                  muscle: 'Cardio',     tags: ['cardio', 'conditioning', 'sled', 'compound', 'quads'] },
  { name: 'Sled Drag',                  muscle: 'Cardio',     tags: ['cardio', 'conditioning', 'sled', 'compound'] },

  // === KETTLEBELL ===
  { name: 'Kettlebell Swing',           muscle: 'Glutes',     tags: ['kettlebell', 'compound', 'hinge', 'explosive', 'hamstrings'] },
  { name: 'Turkish Get-Up',             muscle: 'Core',       tags: ['kettlebell', 'compound', 'full-body', 'stability'] },
  { name: 'Kettlebell Snatch',          muscle: 'Shoulders',  tags: ['kettlebell', 'compound', 'overhead', 'explosive'] },
  { name: 'Kettlebell Clean',           muscle: 'Back',       tags: ['kettlebell', 'compound', 'pull', 'explosive'] },

  // === FUNCTIONAL / CONDITIONING ===
  { name: 'Burpees',                    muscle: 'Cardio',     tags: ['cardio', 'bodyweight', 'compound', 'conditioning', 'full-body'] },
  { name: 'Wall Balls',                 muscle: 'Quads',      tags: ['compound', 'medball', 'squat', 'conditioning', 'shoulders'] },
  { name: "Farmer's Carry",             muscle: 'Traps',      tags: ['compound', 'carry', 'grip', 'dumbbell', 'kettlebell'] },
  { name: 'Suitcase Carry',             muscle: 'Core',       tags: ['compound', 'carry', 'unilateral', 'anti-lateral', 'dumbbell', 'kettlebell'] },

  // === FOUNDATIONAL ===
  { name: 'Inverted Row',               muscle: 'Back',       tags: ['pull', 'horizontal', 'bodyweight', 'compound'] },
  { name: 'Push Press',                 muscle: 'Shoulders',  tags: ['press', 'vertical', 'barbell', 'compound', 'explosive'] },
  { name: 'Glute-Ham Raise',            muscle: 'Hamstrings', tags: ['compound', 'machine', 'bodyweight', 'glutes'] },

  // === CORE ===
  { name: 'Pallof Press',               muscle: 'Core',       tags: ['anti-rotation', 'cable', 'isolation', 'stability'] },
  { name: 'Side Plank',                 muscle: 'Core',       tags: ['isometric', 'bodyweight', 'isolation', 'obliques'] },
  { name: 'V-Ups',                      muscle: 'Core',       tags: ['bodyweight', 'isolation', 'abs'] },
  { name: 'Cable Woodchopper',          muscle: 'Core',       tags: ['rotation', 'cable', 'isolation', 'obliques'] },
  { name: 'Decline Sit-Up',             muscle: 'Core',       tags: ['bodyweight', 'isolation', 'abs', 'decline'] },

  // === BACK (medium priority) ===
  { name: 'Chest-Supported Row',        muscle: 'Back',       tags: ['pull', 'horizontal', 'machine', 'dumbbell', 'compound', 'lats'] },
  { name: 'Meadows Row',                muscle: 'Back',       tags: ['pull', 'horizontal', 'barbell', 'compound', 'lats', 'unilateral'] },
  { name: 'Rack Pull',                  muscle: 'Back',       tags: ['pull', 'barbell', 'compound', 'hinge', 'partial'] },
  { name: 'Reverse-Grip Lat Pulldown',  muscle: 'Back',       tags: ['pull', 'vertical', 'cable', 'compound', 'lats', 'underhand'] },

  // === LEGS (medium priority) ===
  { name: 'Box Squat',                  muscle: 'Quads',      tags: ['squat', 'barbell', 'compound', 'powerlifting'] },
  { name: 'Belt Squat',                 muscle: 'Quads',      tags: ['squat', 'machine', 'compound'] },
  { name: 'Single-Leg Hip Thrust',      muscle: 'Glutes',     tags: ['compound', 'unilateral', 'hinge', 'bodyweight', 'barbell'] },
  { name: 'Tibialis Raise',             muscle: 'Calves',     tags: ['isolation', 'bodyweight', 'shin'] },

  // === BICEPS / TRICEPS (medium priority) ===
  { name: 'Bayesian Cable Curl',        muscle: 'Biceps',     tags: ['curl', 'cable', 'isolation', 'stretch'] },
  { name: 'JM Press',                   muscle: 'Triceps',    tags: ['press', 'barbell', 'compound', 'triceps'] },
];

const { rows: existingRows } = await pool.query(
  "SELECT LOWER(name) AS name FROM exercises WHERE created_by IS NULL"
);
const existing = new Set(existingRows.map((r) => r.name));

console.log(`Master library currently has ${existing.size} exercises.`);
console.log(`Proposing ${NEW_EXERCISES.length} additions.\n`);

let added = 0;
let skipped = 0;
const skippedNames = [];

for (const ex of NEW_EXERCISES) {
  if (existing.has(ex.name.toLowerCase())) {
    skipped++;
    skippedNames.push(ex.name);
    continue;
  }
  await pool.query(
    `INSERT INTO exercises (name, muscle_group, tags, is_custom, created_by)
     VALUES ($1, $2, $3, FALSE, NULL)`,
    [ex.name, ex.muscle, ex.tags]
  );
  console.log(`  + added: ${ex.name.padEnd(28)} [${ex.muscle}]`);
  added++;
}

console.log('');
console.log(`Added:   ${added}`);
console.log(`Skipped: ${skipped} (already in library)`);
if (skippedNames.length) {
  console.log(`Skipped names: ${skippedNames.join(', ')}`);
}

const { rows: finalRows } = await pool.query(
  "SELECT COUNT(*)::int AS count FROM exercises WHERE created_by IS NULL"
);
console.log(`\nMaster library now has ${finalRows[0].count} exercises.`);

process.exit(0);
