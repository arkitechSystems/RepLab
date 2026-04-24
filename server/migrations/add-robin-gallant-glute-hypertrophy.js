// Adds Robin Gallant's Intensive Max Glute Hypertrophy Program to the
// library, populates templates (4 weeks × 7 days = 28 templates), adds
// any missing exercises to the master library, and sets program_details
// so the collapsible Program Details accordion renders.
//
// Source: client/public/Workouts/Robin Gallant's Intensive Max Glute
// Hypertrophy Program.xlsx. The xlsx only has Week 1 fully specified and
// 4 progression hints for Weeks 2-4, so Week 1's exercise list is the
// template for every week with progression overrides applied where the
// xlsx calls them out.
//
// Schedule (from Program Overview: "2 days on, 1 day off, 3 days on, 1 day off"):
//   Day 1 (Sun): Workout Day 1
//   Day 2 (Mon): Workout Day 2
//   Day 3 (Tue): REST
//   Day 4 (Wed): Workout Day 3
//   Day 5 (Thu): Workout Day 4
//   Day 6 (Fri): Workout Day 5
//   Day 7 (Sat): REST
//
// Run with: node --env-file=server/.env server/migrations/add-robin-gallant-glute-hypertrophy.js
// Idempotent: deletes existing templates for the program before rebuilding.

import pool from '../dbPool.js';

const PROGRAM_NAME = "Robin Gallant's Intensive Max Glute Hypertrophy";
const SORT_ORDER = 19;
const PROGRAM_TYPE = 'hypertrophy';

const DETAILS = {
  Program: 'Intensive Max Glute Hypertrophy',
  Source: 'Robin Gallant',
  'Main Goal': 'Hypertrophy (glute emphasis)',
  'Training Level': 'Intermediate',
  'Program Duration': '4 Weeks',
  'Days Per Week': '5 Days',
  'Time Per Workout': '60-90 Mins',
  Equipment: 'Barbell, Dumbbells, Cables, Machines',
  Author: 'Robin Gallant',
  Overview:
    'Full-body hypertrophy program emphasizing glute development, with secondary focus on hamstrings and delts. Uses an RPE-based (auto-regulated) system where intensity is adjusted based on perceived effort. Progression occurs by increasing reps within a range before increasing weight. Mind-muscle connection is emphasized, especially for glutes, with prehab routines included for activation. Schedule follows 2 days on, 1 day off, 3 days on, 1 day off.',
  'Key Concepts': 'RPE-based training, progressive overload, glute activation, supersets, prehab routines',
};

// Week 1 is the base template for each workout day. Each entry:
//   { name, sets, reps, rpe, rest, notes, muscle }
const DAY_1 = [
  { name: 'Back Squat',            sets: 5, reps: '6-8 / 8-10', rpe: '7 / 9', rest: '1-1.5 min', notes: 'Focus on external hip rotation', muscle: 'Quads' },
  { name: 'Barbell RDL',           sets: 3, reps: '12-15',      rpe: '9',     rest: '1.0 min',   notes: 'Use straps if grip limiting',  muscle: 'Hamstrings' },
  { name: 'Walking Lunge',         sets: 3, reps: '18-20',      rpe: '9',     rest: '1.5 min',   notes: 'Short stride, forward lean',    muscle: 'Quads' },
  { name: 'Cable Glute Kickback',  sets: 3, reps: '12-15',      rpe: '9',     rest: '1.0 min',   notes: 'Torso parallel',                muscle: 'Glutes' },
];
const DAY_2 = [
  { name: 'Incline Press',         sets: 3, reps: '8-10', rpe: '9', rest: '1.0 min', notes: 'Machine or dumbbell', muscle: 'Chest' },
  { name: 'DB Lateral Raise',      sets: 3, reps: '12',   rpe: '9', rest: '0.5 min', notes: 'Avoid shrugging',     muscle: 'Shoulders' },
];
const DAY_3 = [
  { name: 'Leg Press',             sets: 4, reps: '10-12', rpe: '9', rest: '0.5 min', notes: 'Feet high, wide stance', muscle: 'Quads' },
];
const DAY_4 = [
  { name: 'Machine Row',           sets: 3, reps: '10-12', rpe: '9', rest: '0.5 min', notes: 'Machine of choice',      muscle: 'Back' },
];
const DAY_5 = [
  { name: 'American Deadlift',     sets: 3, reps: '8-10',  rpe: '9', rest: '1.0 min', notes: 'Glute lockout emphasis', muscle: 'Glutes' },
];

// Progression overrides spelled out in the xlsx.
// Key: `w${week}-d${day}-${exerciseName}` → partial override.
const PROGRESSION = {
  'w3-d1-Back Squat':        { sets: 6 },  // 2+4 from the xlsx
  'w4-d5-American Deadlift': { sets: 4 },  // 4 sets from the xlsx
};

function workoutForDay(dayIdx) {
  // dayIdx is the xlsx "Day N" index (1-5)
  return [DAY_1, DAY_2, DAY_3, DAY_4, DAY_5][dayIdx - 1];
}

// Map from 7-day slot (0-6) to xlsx workout-day index, or null for rest.
// Schedule: 2 on, 1 off, 3 on, 1 off.
const WEEKLY_PATTERN = [1, 2, null, 3, 4, 5, null];

function parsePlannedReps(repRange) {
  if (!repRange) return 10;
  // Take the upper bound of the last range (handles "6-8 / 8-10" → 10).
  const matches = [...String(repRange).matchAll(/(\d+)(?:\s*[-–]\s*(\d+))?/g)];
  if (!matches.length) return 10;
  const last = matches[matches.length - 1];
  return Number(last[2] || last[1]) || 10;
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find or create the program row.
    const { rows: existing } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );
    let programId;
    if (existing.length) {
      programId = existing[0].id;
      await client.query(
        `UPDATE programs SET description = $1, sort_order = $2, program_type = $3, program_details = $4
         WHERE id = $5`,
        [DETAILS.Overview, SORT_ORDER, PROGRAM_TYPE, JSON.stringify(DETAILS), programId]
      );
      console.log(`Program already exists (id=${programId}); details refreshed.`);
    } else {
      const { rows: [p] } = await client.query(
        `INSERT INTO programs (user_id, name, description, sort_order, program_type, program_details)
         VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id`,
        [PROGRAM_NAME, DETAILS.Overview, SORT_ORDER, PROGRAM_TYPE, JSON.stringify(DETAILS)]
      );
      programId = p.id;
      console.log(`Created program "${PROGRAM_NAME}" (id=${programId}).`);
    }

    // 2. Ensure every referenced exercise is in the master library.
    const allExercises = new Map();
    for (const day of [DAY_1, DAY_2, DAY_3, DAY_4, DAY_5]) {
      for (const ex of day) allExercises.set(ex.name, ex.muscle);
    }
    const { rows: existingExRows } = await client.query('SELECT LOWER(name) AS n FROM exercises');
    const existingEx = new Set(existingExRows.map((r) => r.n));
    let added = 0;
    for (const [name, muscle] of allExercises) {
      if (existingEx.has(name.toLowerCase())) continue;
      await client.query(
        'INSERT INTO exercises (name, muscle_group, is_custom) VALUES ($1, $2, FALSE)',
        [name, muscle]
      );
      added++;
    }
    console.log(`Exercises: ${added} added, ${allExercises.size - added} already present.`);

    // 3. Clear any previous templates for this program.
    const { rowCount: deleted } = await client.query(
      'DELETE FROM templates WHERE program_id = $1', [programId]
    );
    if (deleted) console.log(`Cleared ${deleted} stale templates.`);

    // 4. Build 4 weeks × 7 days = 28 templates.
    let sortOrder = 0;
    for (let week = 1; week <= 4; week++) {
      for (let slot = 0; slot < 7; slot++) {
        const workoutDayIdx = WEEKLY_PATTERN[slot];
        if (workoutDayIdx === null) {
          await client.query(
            `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
             VALUES (NULL, $1, $2, $3, TRUE, $4)`,
            [programId, 'Rest', 'Recovery day.', sortOrder++]
          );
          continue;
        }

        const templateName = `Week ${week} · Day ${workoutDayIdx}`;
        const { rows: [tpl] } = await client.query(
          `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
           VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id`,
          [programId, templateName, 'RPE-based auto-regulated work. Rest noted per exercise.', sortOrder++]
        );
        const templateId = tpl.id;

        let exOrder = 0;
        for (const base of workoutForDay(workoutDayIdx)) {
          const override = PROGRESSION[`w${week}-d${workoutDayIdx}-${base.name}`] || {};
          const ex = { ...base, ...override };
          const plannedReps = parsePlannedReps(ex.reps);
          const description = [
            `RPE ${ex.rpe}`,
            `Rest ${ex.rest}`,
            ex.notes,
          ].filter(Boolean).join(' · ');
          const thisOrder = exOrder++;
          for (let s = 1; s <= ex.sets; s++) {
            await client.query(
              `INSERT INTO template_exercises
                (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description)
               VALUES ($1, $2, 'straight', $3, $4, 0, $5, $6, $7)`,
              [templateId, ex.name, s, plannedReps, thisOrder, ex.reps, description]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Created ${sortOrder} templates for "${PROGRAM_NAME}".`);
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
