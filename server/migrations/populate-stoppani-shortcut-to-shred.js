// Migration: Populate Jim Stoppani's Shortcut to Shred with its 36 workouts
// (6 weeks × 6 workouts/week) and make sure every referenced exercise exists
// in the master `exercises` library.
//
// Idempotent:
//   - Exercises: INSERT ON CONFLICT DO NOTHING by case-insensitive name.
//   - Templates: all existing templates for this program are deleted before
//     re-insert (CASCADE cleans up template_exercises).
//
// Run with: node --env-file=server/.env server/migrations/populate-stoppani-shortcut-to-shred.js

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';
import pool from '../dbPool.js';
import { deleteLibraryProgramTemplatesWithGuard } from './_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROGRAM_NAME = "Jim Stoppani's Shortcut to Shred";
const XLSX_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'client',
  'public',
  'Workouts',
  "Jim Stopanni's Shortcut to Shred.xlsx"
);

// Xlsx MuscleGroup → master-library muscle_group. The master lib only has
// Quads/Hamstrings/Glutes for lower body; pick the primary target per
// exercise for the "Legs" bucket.
const DEFAULT_MUSCLE_BY_GROUP = {
  Chest: 'Chest',
  Triceps: 'Triceps',
  Biceps: 'Biceps',
  'Biceps/Forearms': 'Biceps',
  Forearms: 'Biceps',
  Shoulders: 'Shoulders',
  Back: 'Back',
  Traps: 'Traps',
  Calves: 'Calves',
  Abs: 'Core',
  Legs: 'Quads',
};

// Per-exercise overrides for Legs so we pick the accurate primary muscle.
const EXERCISE_MUSCLE_OVERRIDES = {
  Deadlift: 'Hamstrings',
  'Leg Curl': 'Hamstrings',
  'Smith Machine Hip Thrust': 'Glutes', // mis-grouped as Abs in xlsx
};

function muscleFor(row) {
  return EXERCISE_MUSCLE_OVERRIDES[row.Exercise]
    || DEFAULT_MUSCLE_BY_GROUP[row.MuscleGroup]
    || 'Other';
}

function phaseNote(phase) {
  return phase === 'Phase 2'
    ? 'Phase 2. Cardio acceleration between sets. Rest-pause dropset on the last set of each exercise: take to failure, ~15-20s cardio, continue to failure, drop weight 20-30%, repeat.'
    : 'Phase 1. Cardio acceleration between sets (~1 min; beginners 30s).';
}

async function run() {
  // Parse xlsx up front
  const wb = xlsx.readFile(XLSX_PATH);
  const workoutsSheet = wb.Sheets['Workouts'];
  if (!workoutsSheet) throw new Error('Workouts sheet missing from xlsx');
  const rows = xlsx.utils.sheet_to_json(workoutsSheet, { defval: '' });
  if (!rows.length) throw new Error('Workouts sheet is empty');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Program lookup
    const { rows: progs } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );
    if (!progs.length) {
      throw new Error(`Program "${PROGRAM_NAME}" not found — run add-stoppani-shortcut-to-shred.js first.`);
    }
    const programId = progs[0].id;
    console.log(`Program id=${programId}`);

    // 2. Make sure every unique exercise exists in the master library.
    //    Case-insensitive exact-name match against existing rows; add missing.
    const uniqueByName = new Map();
    for (const r of rows) {
      if (!uniqueByName.has(r.Exercise)) uniqueByName.set(r.Exercise, r);
    }
    const { rows: existingExRows } = await client.query('SELECT LOWER(name) AS n FROM exercises');
    const existingSet = new Set(existingExRows.map((r) => r.n));
    let added = 0;
    for (const ex of uniqueByName.values()) {
      if (existingSet.has(ex.Exercise.toLowerCase())) continue;
      await client.query(
        'INSERT INTO exercises (name, muscle_group, is_custom) VALUES ($1, $2, FALSE)',
        [ex.Exercise, muscleFor(ex)]
      );
      added++;
    }
    console.log(`Master exercise library: ${added} new, ${uniqueByName.size - added} already present.`);

    // 3. Clear any previous templates for this program (idempotent re-run).
    //    template_exercises cascades.
    const { rowCount: deleted } = await deleteLibraryProgramTemplatesWithGuard(
      client, programId, { migrationName: 'populate-stoppani-shortcut-to-shred' }
    );
    if (deleted) console.log(`Cleared ${deleted} stale templates for program ${programId}.`);

    // 4. Group rows by (Week, WorkoutNumber) and build templates in order.
    //    Sort explicitly so we don't depend on xlsx row order.
    const byTemplate = new Map();
    for (const r of rows) {
      const key = `${r.Week}-${r.WorkoutNumber}`;
      if (!byTemplate.has(key)) byTemplate.set(key, { week: r.Week, workoutNum: r.WorkoutNumber, phase: r.Phase, name: r.WorkoutName, rows: [] });
      byTemplate.get(key).rows.push(r);
    }
    const ordered = [...byTemplate.values()].sort((a, b) =>
      a.week !== b.week ? a.week - b.week : a.workoutNum - b.workoutNum
    );

    let templateSortOrder = 0;
    let prevWeek = null;

    async function insertRestDay(week, phase) {
      await client.query(
        `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, phase)
         VALUES (NULL, $1, $2, $3, TRUE, $4, $5)`,
        [programId, 'Rest', 'Recovery day.', templateSortOrder++, phase]
      );
    }

    for (const t of ordered) {
      // 6 workouts + 1 rest day per week → 7 templates per week so the
      // Browse Library weekly view (which groups in blocks of 7) aligns.
      // Insert the rest day immediately after the previous week's last
      // workout, i.e. when we see the first workout of a new week.
      if (prevWeek !== null && t.week !== prevWeek) {
        await insertRestDay(prevWeek, ordered.find((x) => x.week === prevWeek)?.phase);
      }
      prevWeek = t.week;

      const templateName = `Week ${t.week} · ${t.name}`;
      const description = phaseNote(t.phase);

      const { rows: [tpl] } = await client.query(
        `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, phase)
         VALUES (NULL, $1, $2, $3, FALSE, $4, $5) RETURNING id`,
        [programId, templateName, description, templateSortOrder++, t.phase]
      );
      const templateId = tpl.id;

      // Exercises: one row per set. Sort within the template by ExerciseOrder.
      const sortedExercises = [...t.rows].sort((a, b) => a.ExerciseOrder - b.ExerciseOrder);
      let exerciseSortOrder = 0;
      for (const ex of sortedExercises) {
        const setCount = Number(ex.Sets) || 1;
        const repRange = String(ex.Reps || '');
        const plannedReps = parsePlannedReps(repRange);
        const setOrder = exerciseSortOrder++;
        for (let setNum = 1; setNum <= setCount; setNum++) {
          await client.query(
            `INSERT INTO template_exercises
              (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description)
             VALUES ($1, $2, 'straight', $3, $4, 0, $5, $6, $7)`,
            [templateId, ex.Exercise, setNum, plannedReps, setOrder, repRange, ex.ExerciseDescription || '']
          );
        }
      }
    }

    // Rest day at the end of the final week.
    if (prevWeek !== null) {
      await insertRestDay(prevWeek, ordered.find((x) => x.week === prevWeek)?.phase);
    }

    await client.query('COMMIT');
    console.log(`Created ${templateSortOrder} templates for "${PROGRAM_NAME}" (${ordered.length} workouts + rest days).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// "9-11" → 11 (top of range), "16-20" → 20, "" → 10, "8" → 8.
function parsePlannedReps(repRange) {
  if (!repRange) return 10;
  const match = String(repRange).match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!match) return 10;
  return Number(match[2] || match[1]) || 10;
}

run();
