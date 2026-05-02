// Populate "Muscle & Fitness 5000 Rep Arm Specialization" with its 10-week
// Blast/Cruise alternating schedule. 70 templates total (10 weeks × 7 days).
// Rest days are placed Sun/Tue/Thu/Sat on Blast weeks and Sun/Tue/Wed/Fri/Sat
// on Cruise weeks, matching the "10 Week Schedule" sheet's workout days
// (Blast: Mon/Wed/Fri, Cruise: Mon/Thu).
//
// Also writes the rich `program_details` JSON from the Program Description
// sheet so the Browse Library can show an expandable details card.
//
// Idempotent: deletes existing templates for the program before rebuilding.
//
// Run with: node --env-file=server/.env server/migrations/populate-muscle-strength-5000-arms.js

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';
import pool from '../dbPool.js';
import { deleteLibraryProgramTemplatesWithGuard } from './_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROGRAM_NAME = 'Muscle & Fitness 5000 Rep Arm Specialization';
const XLSX_PATH = path.resolve(
  __dirname, '..', '..',
  'client', 'public', 'Workouts',
  'Muscle and Strength 5000 rep Arm Specialization Program.xlsx'
);

// Day 0 = Sunday. Week runs Sun..Sat (7 days).
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_INDEX = Object.fromEntries(DAY_NAMES.map((d, i) => [d, i]));

// 10-week alternating schedule — weeks 1,3,5,7,9 = Blast; 2,4,6,8,10 = Cruise.
function weekTypeFor(week) {
  return week % 2 === 1 ? 'Blast Week' : 'Cruise Week';
}

// Muscle group mapping for master library inserts.
const EXERCISE_MUSCLE = {
  'Bench Press': 'Chest',
  'Pec Dec': 'Chest',
  'Military Press': 'Shoulders',
  'Side Lateral Raise': 'Shoulders',
  'Close Grip Bench Press': 'Triceps',
  'Dumbbell Curls': 'Biceps',
  'Lying Triceps Extension': 'Triceps',
  'Rope Cable Curls': 'Biceps',
  'Close Grip Push Ups': 'Triceps',
  'Squats': 'Quads',
  'Leg Extensions': 'Quads',
  'Leg Curls': 'Hamstrings',
  'Seated Calf Raises': 'Calves',
  'French Press': 'Triceps',
  'EZ Bar Curls': 'Biceps',
  'Bench Dips': 'Triceps',
  'Hammer Curls': 'Biceps',
  'Dumbbell Kickbacks': 'Triceps',
  'Deadlifts': 'Hamstrings',
  'Barbell Rows': 'Back',
  'V-Bar Pull Downs': 'Back',
  'Barbell Shrugs': 'Traps',
  'Tate Press': 'Triceps',
  'Barbell Curls': 'Biceps',
  'Cable Tricep Extensions': 'Triceps',
  'Machine Curls': 'Biceps',
  'Dumbbell Tricep Extensions': 'Triceps',
  'Weighted Chin Ups (Palms Toward Face)': 'Back',
  'Lying Tricep Extensions': 'Triceps',
};

function parsePlannedReps(repRange) {
  if (!repRange) return 10;
  const match = String(repRange).match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!match) return 10;
  return Number(match[2] || match[1]) || 10;
}

function readWorkoutsFromSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error(`Missing sheet: ${sheetName}`);
  // Header is on row 1 (0-indexed), data starts row 2. Use header:1 and map.
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  const header = rows[1];
  const dataRows = rows.slice(2);
  // Expected columns: Day, Workout Focus, Section, Exercise, Sets, Reps, Target Reps/Set, Total Target Reps, Notes
  const idx = {
    day: header.indexOf('Day'),
    focus: header.indexOf('Workout Focus'),
    section: header.indexOf('Section'),
    exercise: header.indexOf('Exercise'),
    sets: header.indexOf('Sets'),
    reps: header.indexOf('Reps'),
  };
  const byDay = new Map();
  for (const r of dataRows) {
    const day = r[idx.day];
    if (!day) continue;
    if (!byDay.has(day)) byDay.set(day, { day, focus: r[idx.focus], exercises: [] });
    byDay.get(day).exercises.push({
      section: r[idx.section],
      name: r[idx.exercise],
      sets: Number(r[idx.sets]) || 1,
      repRange: String(r[idx.reps] || ''),
    });
  }
  return byDay;
}

function readProgramDescription(wb) {
  const sheet = wb.Sheets['Program Description'];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  const out = {};
  for (const [k, v] of rows) {
    if (!k || k === 'Program Description') continue;
    out[String(k)] = v;
  }
  return out;
}

async function run() {
  const wb = xlsx.readFile(XLSX_PATH);
  const blastByDay = readWorkoutsFromSheet(wb, 'Blast Week');
  const cruiseByDay = readWorkoutsFromSheet(wb, 'Cruise Week');
  const details = readProgramDescription(wb);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: progs } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );
    if (!progs.length) throw new Error(`Program "${PROGRAM_NAME}" not found`);
    const programId = progs[0].id;

    // 1. Add any referenced exercises to the master library
    const allExercises = new Set();
    for (const d of blastByDay.values()) d.exercises.forEach((e) => allExercises.add(e.name));
    for (const d of cruiseByDay.values()) d.exercises.forEach((e) => allExercises.add(e.name));
    const { rows: existingRows } = await client.query('SELECT LOWER(name) AS n FROM exercises');
    const existing = new Set(existingRows.map((r) => r.n));
    let added = 0;
    for (const name of allExercises) {
      if (existing.has(name.toLowerCase())) continue;
      const muscle = EXERCISE_MUSCLE[name] || 'Other';
      await client.query(
        'INSERT INTO exercises (name, muscle_group, is_custom) VALUES ($1, $2, FALSE)',
        [name, muscle]
      );
      added++;
    }
    console.log(`Exercises: ${added} added, ${allExercises.size - added} already present.`);

    // 2. Save program_details JSON for the expandable card
    await client.query(
      'UPDATE programs SET program_details = $1 WHERE id = $2',
      [JSON.stringify(details), programId]
    );

    // 3. Clear existing templates (idempotent re-run)
    const { rowCount: deleted } = await deleteLibraryProgramTemplatesWithGuard(
      client, programId, { migrationName: 'populate-muscle-strength-5000-arms' }
    );
    if (deleted) console.log(`Cleared ${deleted} stale templates.`);

    // 4. Build 10 weeks × 7 days = 70 templates
    let sortOrder = 0;
    for (let week = 1; week <= 10; week++) {
      const weekType = weekTypeFor(week);
      const source = weekType === 'Blast Week' ? blastByDay : cruiseByDay;

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const dayName = DAY_NAMES[dayIdx];
        const dayWorkout = source.get(dayName);

        if (!dayWorkout) {
          // Rest day
          await client.query(
            `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, phase)
             VALUES (NULL, $1, $2, $3, TRUE, $4, $5)`,
            [programId, 'Rest', 'Recovery day.', sortOrder++, weekType]
          );
          continue;
        }

        // Workout day
        const templateName = `Week ${week} · ${dayName} — ${dayWorkout.focus}`;
        const { rows: [tpl] } = await client.query(
          `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, phase)
           VALUES (NULL, $1, $2, $3, FALSE, $4, $5) RETURNING id`,
          [programId, templateName, `${weekType}. ${dayWorkout.focus}.`, sortOrder++, weekType]
        );
        const templateId = tpl.id;

        // Insert exercises as section headers + sets. Group by `section`.
        let exerciseSortOrder = 0;
        let lastSection = null;
        for (const ex of dayWorkout.exercises) {
          if (ex.section && ex.section !== lastSection) {
            await client.query(
              `INSERT INTO template_exercises
                (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes)
               VALUES ($1, $2, 'straight', 1, 0, 0, $3, TRUE, $4)`,
              [templateId, ex.section, exerciseSortOrder++, '']
            );
            lastSection = ex.section;
          }
          const plannedReps = parsePlannedReps(ex.repRange);
          const thisOrder = exerciseSortOrder++;
          for (let s = 1; s <= ex.sets; s++) {
            await client.query(
              `INSERT INTO template_exercises
                (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description)
               VALUES ($1, $2, 'straight', $3, $4, 0, $5, $6, $7)`,
              [templateId, ex.name, s, plannedReps, thisOrder, ex.repRange, '']
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
