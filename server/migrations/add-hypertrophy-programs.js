// Migration: Add 7 popular hypertrophy/hybrid programs to the WillFit library
// Run with: node --env-file=server/.env server/migrations/add-hypertrophy-programs.js

import pool from '../dbPool.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createProgram(client, name, description, sortOrder, programType) {
  const { rows: [p] } = await client.query(
    `INSERT INTO programs (user_id, name, description, sort_order, program_type)
     VALUES (NULL, $1, $2, $3, $4) RETURNING id`,
    [name, description, sortOrder, programType]
  );
  console.log(`  Created program "${name}" (id=${p.id}, sort=${sortOrder}, type=${programType})`);
  return p.id;
}

async function createTemplate(client, programId, name, description, isRest, sortOrder) {
  const { rows: [t] } = await client.query(
    `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
     VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id`,
    [programId, name, description || '', isRest, sortOrder]
  );
  return t.id;
}

async function createWorkout(client, programId, sortOrder, name, desc, exercises) {
  const tid = await createTemplate(client, programId, name, desc, false, sortOrder);
  let exSort = 0;
  for (const ex of exercises) {
    if (ex.section) {
      await client.query(
        `INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes)
         VALUES ($1, $2, 1, 0, 0, $3, TRUE, $4)`,
        [tid, ex.section, exSort++, ex.notes || '']
      );
      continue;
    }
    for (let i = 0; i < ex.sets; i++) {
      await client.query(
        `INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order)
         VALUES ($1, $2, $3, $4, $5, 0, $6)`,
        [tid, ex.name, ex.type || 'straight', i + 1, ex.reps, exSort]
      );
    }
    exSort++;
  }
  return tid;
}

async function createRest(client, programId, sortOrder) {
  return createTemplate(client, programId, 'Rest Day', '', true, sortOrder);
}

// ── Program Definitions ─────────────────────────────────────────────────────

async function addPHAT(client) {
  const pid = await createProgram(client,
    'PHAT (Power Hypertrophy Adaptive Training)',
    "Layne Norton's 5-day program combining heavy power days with high-volume hypertrophy days. Build size AND strength simultaneously. Intermediate to advanced.",
    10, 'hybrid');

  let s = 0;

  // Day 1: Upper Power
  await createWorkout(client, pid, s++, 'Upper Power', '', [
    { section: 'Power — Heavy Compounds' },
    { name: 'Barbell Row', sets: 3, reps: 5 },
    { name: 'Weighted Pull-Ups', sets: 2, reps: 6 },
    { name: 'Flat Bench Press', sets: 3, reps: 5 },
    { name: 'Overhead Press', sets: 2, reps: 6 },
    { name: 'Barbell Curl', sets: 2, reps: 6 },
    { name: 'Skull Crushers', sets: 2, reps: 6 },
  ]);

  // Day 2: Lower Power
  await createWorkout(client, pid, s++, 'Lower Power', '', [
    { section: 'Power — Heavy Compounds' },
    { name: 'Back Squat', sets: 3, reps: 5 },
    { name: 'Hack Squat', sets: 2, reps: 6 },
    { name: 'Leg Press', sets: 2, reps: 6 },
    { name: 'Leg Curl', sets: 2, reps: 6 },
    { name: 'Calf Raises', sets: 3, reps: 8 },
  ]);

  // Day 3: Rest
  await createRest(client, pid, s++);

  // Day 4: Back & Shoulders Hypertrophy
  await createWorkout(client, pid, s++, 'Back & Shoulders Hypertrophy', '', [
    { section: 'Hypertrophy — High Volume' },
    { name: 'Bent Over Row', sets: 3, reps: 12 },
    { name: 'Cable Row', sets: 3, reps: 12 },
    { name: 'Lat Pulldown', sets: 2, reps: 15 },
    { name: 'Close Grip Pulldown', sets: 2, reps: 15 },
    { name: 'Lateral Raises', sets: 3, reps: 15 },
    { name: 'Rear Delt Fly', sets: 2, reps: 15 },
    { name: 'Face Pulls', sets: 2, reps: 15 },
  ]);

  // Day 5: Lower Hypertrophy
  await createWorkout(client, pid, s++, 'Lower Hypertrophy', '', [
    { section: 'Hypertrophy — High Volume' },
    { name: 'Front Squat', sets: 3, reps: 12 },
    { name: 'Barbell Lunge', sets: 3, reps: 12 },
    { name: 'Leg Extension', sets: 3, reps: 15 },
    { name: 'Leg Curl', sets: 3, reps: 15 },
    { name: 'Seated Calf Raise', sets: 4, reps: 12 },
  ]);

  // Day 6: Chest & Arms Hypertrophy
  await createWorkout(client, pid, s++, 'Chest & Arms Hypertrophy', '', [
    { section: 'Hypertrophy — High Volume' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: 12 },
    { name: 'Cable Flyes', sets: 3, reps: 15 },
    { name: 'Dumbbell Press', sets: 3, reps: 12 },
    { name: 'Preacher Curl', sets: 3, reps: 12 },
    { name: 'Concentration Curl', sets: 2, reps: 15 },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: 15 },
    { name: 'Overhead Tricep Extension', sets: 2, reps: 12 },
  ]);

  // Day 7: Rest
  await createRest(client, pid, s++);
}

async function addPHUL(client) {
  const pid = await createProgram(client,
    'PHUL (Power Hypertrophy Upper Lower)',
    '4-day upper/lower split hitting each muscle group twice per week — once for power (heavy/low rep) and once for hypertrophy (lighter/high rep). Simple and effective for intermediates.',
    11, 'hybrid');

  let s = 0;

  // Day 1: Upper Power
  await createWorkout(client, pid, s++, 'Upper Power', '', [
    { section: 'Power' },
    { name: 'Barbell Bench Press', sets: 4, reps: 5 },
    { name: 'Barbell Row', sets: 4, reps: 5 },
    { name: 'Overhead Press', sets: 3, reps: 6 },
    { name: 'Barbell Curl', sets: 3, reps: 8 },
    { name: 'Skull Crushers', sets: 3, reps: 8 },
  ]);

  // Day 2: Lower Power
  await createWorkout(client, pid, s++, 'Lower Power', '', [
    { section: 'Power' },
    { name: 'Back Squat', sets: 4, reps: 5 },
    { name: 'Deadlift', sets: 3, reps: 5 },
    { name: 'Leg Press', sets: 3, reps: 8 },
    { name: 'Leg Curl', sets: 3, reps: 8 },
    { name: 'Calf Raises', sets: 4, reps: 8 },
  ]);

  // Day 3: Rest
  await createRest(client, pid, s++);

  // Day 4: Upper Hypertrophy
  await createWorkout(client, pid, s++, 'Upper Hypertrophy', '', [
    { section: 'Hypertrophy' },
    { name: 'Incline Dumbbell Press', sets: 4, reps: 12 },
    { name: 'Cable Flyes', sets: 3, reps: 15 },
    { name: 'Seated Cable Row', sets: 4, reps: 12 },
    { name: 'Lat Pulldown', sets: 3, reps: 12 },
    { name: 'Lateral Raises', sets: 3, reps: 15 },
    { name: 'Incline Dumbbell Curl', sets: 3, reps: 12 },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: 15 },
  ]);

  // Day 5: Lower Hypertrophy
  await createWorkout(client, pid, s++, 'Lower Hypertrophy', '', [
    { section: 'Hypertrophy' },
    { name: 'Front Squat', sets: 4, reps: 12 },
    { name: 'Romanian Deadlift', sets: 3, reps: 12 },
    { name: 'Leg Extension', sets: 3, reps: 15 },
    { name: 'Leg Curl', sets: 3, reps: 15 },
    { name: 'Seated Calf Raise', sets: 4, reps: 15 },
  ]);

  // Days 6-7: Rest
  await createRest(client, pid, s++);
  await createRest(client, pid, s++);
}

async function addGVT(client) {
  const pid = await createProgram(client,
    'German Volume Training (GVT)',
    "The legendary '10 Sets Method' by Charles Poliquin. 10x10 at 60% of your 1RM with 60-second rest periods. Brutally effective for muscle growth. Run for 4-6 weeks max. Intermediate to advanced.",
    12, 'hypertrophy');

  let s = 0;

  // Day 1: Chest & Back
  await createWorkout(client, pid, s++, 'Chest & Back', '', [
    { section: '10x10 Superset', notes: 'Alternate between A1 and A2 with 60 seconds rest between each set. Use 60% of your 1RM.' },
    { name: 'Flat Bench Press', sets: 10, reps: 10 },
    { name: 'Bent Over Row', sets: 10, reps: 10 },
    { section: 'Accessory — 3x12' },
    { name: 'Incline Dumbbell Fly', sets: 3, reps: 12 },
    { name: 'Cable Row', sets: 3, reps: 12 },
  ]);

  // Day 2: Legs & Abs
  await createWorkout(client, pid, s++, 'Legs & Abs', '', [
    { section: '10x10 Superset', notes: '60 seconds rest between sets. This will be the hardest day. Do not quit.' },
    { name: 'Back Squat', sets: 10, reps: 10 },
    { name: 'Leg Curl', sets: 10, reps: 10 },
    { section: 'Accessory — 3x12' },
    { name: 'Calf Raises', sets: 3, reps: 15 },
    { name: 'Hanging Leg Raise', sets: 3, reps: 15 },
  ]);

  // Day 3: Rest
  await createRest(client, pid, s++);

  // Day 4: Arms & Shoulders
  await createWorkout(client, pid, s++, 'Arms & Shoulders', '', [
    { section: '10x10 Superset', notes: '60 seconds rest. Alternate biceps and triceps.' },
    { name: 'Barbell Curl', sets: 10, reps: 10 },
    { name: 'Close Grip Bench Press', sets: 10, reps: 10 },
    { section: 'Accessory — 3x12' },
    { name: 'Lateral Raises', sets: 3, reps: 12 },
    { name: 'Rear Delt Fly', sets: 3, reps: 12 },
  ]);

  // Days 5-7: Rest
  await createRest(client, pid, s++);
  await createRest(client, pid, s++);
  await createRest(client, pid, s++);
}

async function addCreepingDeath(client) {
  const pid = await createProgram(client,
    'Creeping Death (John Meadows Inspired)',
    "Inspired by John Meadows' legendary program. 5 days per week featuring intense techniques — drop sets, rest-pause, and cluster sets. Designed for experienced lifters who want extreme muscle growth.",
    13, 'hypertrophy');

  let s = 0;

  // Day 1: Chest & Side Delts
  await createWorkout(client, pid, s++, 'Chest & Side Delts', '', [
    { section: 'Chest' },
    { name: 'Incline Dumbbell Press', sets: 4, reps: 10 },
    { name: 'Machine Chest Press', sets: 3, reps: 12 },
    { name: 'Cable Flyes', sets: 3, reps: 15 },
    { section: 'Side Delts' },
    { name: 'Lateral Raises', sets: 4, reps: 15 },
    { name: 'Cable Lateral Raise', sets: 3, reps: 12 },
  ]);

  // Day 2: Back & Rear Delts
  await createWorkout(client, pid, s++, 'Back & Rear Delts', '', [
    { section: 'Back' },
    { name: 'Meadows Row', sets: 3, reps: 10 },
    { name: 'Lat Pulldown', sets: 4, reps: 12 },
    { name: 'Seated Cable Row', sets: 3, reps: 12 },
    { name: 'Straight Arm Pulldown', sets: 3, reps: 15 },
    { section: 'Rear Delts' },
    { name: 'Face Pulls', sets: 3, reps: 15 },
    { name: 'Rear Delt Fly', sets: 3, reps: 15 },
  ]);

  // Day 3: Legs
  await createWorkout(client, pid, s++, 'Legs', '', [
    { section: 'Quads' },
    { name: 'Leg Extension (Pre-Exhaust)', sets: 3, reps: 15 },
    { name: 'Hack Squat', sets: 4, reps: 10 },
    { name: 'Leg Press', sets: 3, reps: 12 },
    { section: 'Hamstrings & Calves' },
    { name: 'Romanian Deadlift', sets: 3, reps: 10 },
    { name: 'Leg Curl', sets: 3, reps: 12 },
    { name: 'Calf Raises', sets: 4, reps: 15 },
  ]);

  // Day 4: Arms
  await createWorkout(client, pid, s++, 'Arms', '', [
    { section: 'Biceps' },
    { name: 'Barbell Curl', sets: 3, reps: 10 },
    { name: 'Incline Dumbbell Curl', sets: 3, reps: 12 },
    { name: 'Cable Hammer Curl', sets: 3, reps: 15 },
    { section: 'Triceps' },
    { name: 'Close Grip Bench Press', sets: 3, reps: 10 },
    { name: 'Overhead Tricep Extension', sets: 3, reps: 12 },
    { name: 'Cable Tricep Pushdown', sets: 3, reps: 15 },
  ]);

  // Day 5: Weakpoint Day
  await createWorkout(client, pid, s++, 'Weakpoint Day', '', [
    { section: 'Choose Your Weakpoint', notes: 'Pick 2-3 lagging body parts and hit them with 3-4 exercises each, 3x12-15. Focus on mind-muscle connection and slow eccentrics.' },
    { name: 'Weakpoint Exercise 1', sets: 3, reps: 12 },
    { name: 'Weakpoint Exercise 2', sets: 3, reps: 12 },
    { name: 'Weakpoint Exercise 3', sets: 3, reps: 15 },
    { name: 'Weakpoint Exercise 4', sets: 3, reps: 15 },
  ]);

  // Days 6-7: Rest
  await createRest(client, pid, s++);
  await createRest(client, pid, s++);
}

async function addGZCL(client) {
  const pid = await createProgram(client,
    'GZCL Method',
    "Cody Lefever's tier-based system. T1: heavy compound (85-100%), T2: moderate compound (65-85%), T3: high-rep accessories. Highly customizable for both strength and size. 4 days/week.",
    14, 'hybrid');

  let s = 0;

  // Day 1: Squat Day
  await createWorkout(client, pid, s++, 'Squat Day', '', [
    { section: 'T1 — Heavy', notes: '5x3 at 85%+ 1RM. Rest 3-5 min.' },
    { name: 'Back Squat', sets: 5, reps: 3 },
    { section: 'T2 — Moderate', notes: '3x10 at 65-75%. Rest 2 min.' },
    { name: 'Front Squat', sets: 3, reps: 10 },
    { section: 'T3 — Accessories', notes: 'High reps, short rest (60s). Chase the pump.' },
    { name: 'Leg Extension', sets: 3, reps: 15 },
    { name: 'Leg Curl', sets: 3, reps: 15 },
    { name: 'Calf Raises', sets: 3, reps: 20 },
  ]);

  // Day 2: Bench Day
  await createWorkout(client, pid, s++, 'Bench Day', '', [
    { section: 'T1 — Heavy' },
    { name: 'Bench Press', sets: 5, reps: 3 },
    { section: 'T2 — Moderate' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
    { section: 'T3 — Accessories' },
    { name: 'Cable Flyes', sets: 3, reps: 15 },
    { name: 'Tricep Pushdown', sets: 3, reps: 15 },
    { name: 'Face Pulls', sets: 3, reps: 20 },
  ]);

  // Day 3: Rest
  await createRest(client, pid, s++);

  // Day 4: Deadlift Day
  await createWorkout(client, pid, s++, 'Deadlift Day', '', [
    { section: 'T1 — Heavy' },
    { name: 'Deadlift', sets: 5, reps: 3 },
    { section: 'T2 — Moderate' },
    { name: 'Barbell Row', sets: 3, reps: 10 },
    { section: 'T3 — Accessories' },
    { name: 'Lat Pulldown', sets: 3, reps: 15 },
    { name: 'Cable Row', sets: 3, reps: 15 },
    { name: 'Barbell Curl', sets: 3, reps: 15 },
  ]);

  // Day 5: OHP Day
  await createWorkout(client, pid, s++, 'OHP Day', '', [
    { section: 'T1 — Heavy' },
    { name: 'Overhead Press', sets: 5, reps: 3 },
    { section: 'T2 — Moderate' },
    { name: 'Close Grip Bench Press', sets: 3, reps: 10 },
    { section: 'T3 — Accessories' },
    { name: 'Lateral Raises', sets: 3, reps: 15 },
    { name: 'Rear Delt Fly', sets: 3, reps: 15 },
    { name: 'Overhead Tricep Extension', sets: 3, reps: 15 },
  ]);

  // Days 6-7: Rest
  await createRest(client, pid, s++);
  await createRest(client, pid, s++);
}

async function addNSuns(client) {
  const pid = await createProgram(client,
    'nSuns 5/3/1 LP',
    "A high-volume linear progression based on Wendler's 5/3/1. Known for aggressive progression with 9 working sets on main lifts plus back-off sets. Very popular with intermediate lifters. 5 days/week.",
    15, 'hybrid');

  let s = 0;

  // Day 1: Bench & OHP
  await createWorkout(client, pid, s++, 'Bench & OHP', '', [
    { section: 'T1 — Bench Press', notes: 'Work up to a top set, then descending sets. Follow the nSuns progression spreadsheet for exact percentages.' },
    { name: 'Bench Press', sets: 9, reps: 3 },
    { section: 'T2 — Overhead Press' },
    { name: 'Overhead Press', sets: 8, reps: 3 },
    { section: 'Accessories' },
    { name: 'Lat Pulldown', sets: 3, reps: 12 },
    { name: 'Face Pulls', sets: 3, reps: 15 },
    { name: 'Barbell Curl', sets: 3, reps: 12 },
  ]);

  // Day 2: Squat & Sumo Deadlift
  await createWorkout(client, pid, s++, 'Squat & Sumo Deadlift', '', [
    { section: 'T1 — Squat' },
    { name: 'Back Squat', sets: 9, reps: 3 },
    { section: 'T2 — Sumo Deadlift' },
    { name: 'Sumo Deadlift', sets: 8, reps: 3 },
    { section: 'Accessories' },
    { name: 'Leg Extension', sets: 3, reps: 12 },
    { name: 'Leg Curl', sets: 3, reps: 12 },
  ]);

  // Day 3: Rest
  await createRest(client, pid, s++);

  // Day 4: OHP & Incline Bench
  await createWorkout(client, pid, s++, 'OHP & Incline Bench', '', [
    { section: 'T1 — Overhead Press' },
    { name: 'Overhead Press', sets: 9, reps: 3 },
    { section: 'T2 — Incline Bench' },
    { name: 'Incline Bench Press', sets: 8, reps: 3 },
    { section: 'Accessories' },
    { name: 'Cable Flyes', sets: 3, reps: 15 },
    { name: 'Lateral Raises', sets: 3, reps: 15 },
    { name: 'Tricep Pushdown', sets: 3, reps: 12 },
  ]);

  // Day 5: Deadlift & Front Squat
  await createWorkout(client, pid, s++, 'Deadlift & Front Squat', '', [
    { section: 'T1 — Deadlift' },
    { name: 'Deadlift', sets: 9, reps: 3 },
    { section: 'T2 — Front Squat' },
    { name: 'Front Squat', sets: 8, reps: 3 },
    { section: 'Accessories' },
    { name: 'Barbell Row', sets: 3, reps: 12 },
    { name: 'Hanging Leg Raise', sets: 3, reps: 15 },
  ]);

  // Days 6-7: Rest
  await createRest(client, pid, s++);
  await createRest(client, pid, s++);
}

async function addScienceBased(client) {
  const pid = await createProgram(client,
    'Science-Based Upper/Lower (Jeff Nippard Inspired)',
    'A science-based 4-day upper/lower split emphasizing progressive overload with periodized volume. Focuses on compound movements with targeted isolation work. Great balance for natural lifters.',
    16, 'hypertrophy');

  let s = 0;

  // Day 1: Upper A (Horizontal Focus)
  await createWorkout(client, pid, s++, 'Upper A (Horizontal Focus)', '', [
    { section: 'Compounds' },
    { name: 'Bench Press', sets: 4, reps: 8 },
    { name: 'Barbell Row', sets: 4, reps: 8 },
    { section: 'Isolation' },
    { name: 'Incline Dumbbell Press', sets: 3, reps: 12 },
    { name: 'Cable Flyes', sets: 3, reps: 15 },
    { name: 'Lateral Raises', sets: 3, reps: 15 },
    { name: 'Face Pulls', sets: 3, reps: 15 },
    { name: 'Barbell Curl', sets: 3, reps: 12 },
    { name: 'Overhead Tricep Extension', sets: 3, reps: 12 },
  ]);

  // Day 2: Lower A (Quad Focus)
  await createWorkout(client, pid, s++, 'Lower A (Quad Focus)', '', [
    { section: 'Compounds' },
    { name: 'Back Squat', sets: 4, reps: 8 },
    { name: 'Romanian Deadlift', sets: 3, reps: 10 },
    { section: 'Isolation' },
    { name: 'Leg Extension', sets: 3, reps: 12 },
    { name: 'Leg Curl', sets: 3, reps: 12 },
    { name: 'Calf Raises', sets: 4, reps: 15 },
    { name: 'Cable Crunch', sets: 3, reps: 15 },
  ]);

  // Day 3: Rest
  await createRest(client, pid, s++);

  // Day 4: Upper B (Vertical Focus)
  await createWorkout(client, pid, s++, 'Upper B (Vertical Focus)', '', [
    { section: 'Compounds' },
    { name: 'Overhead Press', sets: 4, reps: 8 },
    { name: 'Weighted Pull-Ups', sets: 4, reps: 8 },
    { section: 'Isolation' },
    { name: 'Dumbbell Lateral Raise', sets: 3, reps: 15 },
    { name: 'Cable Row', sets: 3, reps: 12 },
    { name: 'Incline Dumbbell Curl', sets: 3, reps: 12 },
    { name: 'Skull Crushers', sets: 3, reps: 12 },
    { name: 'Rear Delt Fly', sets: 3, reps: 15 },
  ]);

  // Day 5: Lower B (Posterior Focus)
  await createWorkout(client, pid, s++, 'Lower B (Posterior Focus)', '', [
    { section: 'Compounds' },
    { name: 'Deadlift', sets: 4, reps: 6 },
    { name: 'Front Squat', sets: 3, reps: 10 },
    { section: 'Isolation' },
    { name: 'Hip Thrust', sets: 3, reps: 12 },
    { name: 'Leg Curl', sets: 3, reps: 12 },
    { name: 'Seated Calf Raise', sets: 4, reps: 15 },
    { name: 'Hanging Leg Raise', sets: 3, reps: 12 },
  ]);

  // Days 6-7: Rest
  await createRest(client, pid, s++);
  await createRest(client, pid, s++);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding 7 hypertrophy/hybrid programs...\n');

    await addPHAT(client);
    await addPHUL(client);
    await addGVT(client);
    await addCreepingDeath(client);
    await addGZCL(client);
    await addNSuns(client);
    await addScienceBased(client);

    await client.query('COMMIT');

    // Summary
    const { rows } = await client.query(
      `SELECT p.id, p.name, p.program_type, COUNT(t.id) AS templates
       FROM programs p
       LEFT JOIN templates t ON t.program_id = p.id
       WHERE p.user_id IS NULL AND p.sort_order >= 10 AND p.sort_order <= 16
       GROUP BY p.id ORDER BY p.sort_order`
    );
    console.log('\n=== Summary ===');
    for (const r of rows) {
      console.log(`  [${r.id}] ${r.name} (${r.program_type}) — ${r.templates} templates`);
    }
    console.log(`\nDone! Added ${rows.length} programs.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
