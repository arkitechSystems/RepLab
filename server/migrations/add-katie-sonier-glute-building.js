// Adds Katie Sonier's 6-Week Glute Building Program 3.0 to the library.
// 6 weeks × 3 days/week (Mon/Wed/Fri) = 18 actual workouts; 4 rest days
// per week → 42 templates total. Glute-focused program (program_type =
// 'glute_focused' so the same pink "Glute-Focused" tag Robin Gallant uses
// applies here too).
//
// Source: client/public/Workouts/Katie-Sonier-6-week-glute-building-program-3.xlsx
//
// Column D ("Group") drives set_type:
//   "Superset N" → set_type = 'superset'
//   anything else → 'straight' (regular)
//
// Run with:
//   node --env-file=server/.env server/migrations/add-katie-sonier-glute-building.js
//
// Idempotent — clears existing templates for this program before rebuilding.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';
import pool from '../dbPool.js';
import { deleteLibraryProgramTemplatesWithGuard } from './_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROGRAM_NAME = "Katie Sonier's 6-Week Glute Building Program";
const SHORT_NAME = "Katie's Glutes";
const SORT_ORDER = 21;
const PROGRAM_TYPE = 'glute_focused';

const XLSX_PATH = path.resolve(
  __dirname, '..', '..',
  'client', 'public', 'Workouts',
  'Katie-Sonier-6-week-glute-building-program-3.xlsx'
);

// User-supplied program description (long-form copy from the PDF). Splits
// into the same Descriptions[]/Schedule[] shape as Robin Gallant so the
// existing ProgramDetailsCard renders all paragraphs cleanly.
const DESCRIPTIONS = [
  'HIP THRUST SENSATION VS. STRENGTH REPS: We will be performing the barbell hip thrust at a variety of rep ranges and loads. 2 days a week, we will be performing relatively higher rep ranges and 1 day a week we will be working more "strength" reps or lower rep ranges. For maximum hypertrophy gains, you want to be getting stronger in a variety of rep ranges. Obviously loads will be different for higher vs lower rep ranges. You will notice that performing higher rep barbell hip thrusts leaves you with an insane glute burn and glute "pump"- which is just blood flow to the muscle. These are "sensation" reps- you are working for that total burn/fatigue/pump sensation. You will also notice that when performing in the lower rep ranges, or strength reps, you don\'t feel that intense burn as much. That\'s normal. It\'s important to hit all rep ranges to make sure we are both growing and getting stronger over time.',
  'STRONG GLUTES = STRONG BODY: Compound lifts (multi-joint exercises) make up the majority of this programming. You will see that we will be performing many barbell hip thrusts, barbell deadlift variations, and lunging variations. These lifts will both build your glutes and get you strong. As your glutes get stronger, so will the rest of your body! They go hand in hand.',
];

const SCHEDULE = [
  'Monday / Wednesday / Friday glute training for 6 weeks.',
  'Each session prioritizes the barbell hip thrust because peak glute activation occurs at end-range hip extension.',
  'Tuesday, Thursday, Saturday, and Sunday are rest days; you may shift them to fit your schedule but keep all 3 sessions in.',
  'Warm up appropriately before each session — Katie recommends a dynamic mobility routine (e.g. the world\'s greatest stretch).',
  'Friday\'s lower-rep barbell hip thrusts require warm-up sets: 1-2 sets of 5 reps at 60% of working weight, then 1-2 sets of 3 reps at 80%.',
  'Recover well between sessions — sleep, calories, and protein matter. Don\'t chase soreness; chase consistency and PRs.',
];

const PROGRAM_DETAILS = {
  Program: "Katie Sonier's 6-Week Glute Building Program 3.0",
  Source: "Katie-Sonier-6-week-glute-building-program-3.pdf",
  Author: 'Katie Sonier',
  'Main Goal': 'Hypertrophy (glute emphasis)',
  'Training Level': 'Intermediate',
  'Program Duration': '6 Weeks',
  'Days Per Week': '3 Days (Mon / Wed / Fri)',
  'Time Per Workout': '60-90 Mins',
  Equipment: 'Barbell, Dumbbells, Resistance Bands, Hip Thrust Pad, Bench',
  Overview: DESCRIPTIONS[0],
  Descriptions: DESCRIPTIONS,
  Schedule: SCHEDULE,
};

function muscleFor(name) {
  const n = String(name).toUpperCase();
  if (/\bCALF|CALVES\b/.test(n)) return 'Calves';
  if (/\bLEG CURL|HAMSTRING|RDL|ROMANIAN|GOOD MORNING\b/.test(n)) return 'Hamstrings';
  if (/\bHIP THRUST|GLUTE|FROG PUMP|FIRE HYDRANT|HIP ABDUCTION|CABLE KICK|GLUTE BRIDGE|SUMO\b/.test(n)) return 'Glutes';
  if (/\bSQUAT|LUNGE|LEG EXTENSION|LEG PRESS|GOBLET|BULGARIAN|STEP[- ]?UP\b/.test(n)) return 'Quads';
  if (/\bDEADLIFT\b/.test(n)) return 'Hamstrings';
  if (/\bSHRUG\b/.test(n)) return 'Traps';
  if (/\bCURL\b/.test(n) && !/LEG CURL/.test(n)) return 'Biceps';
  if (/\bSHOULDER PRESS|MILITARY|ARNOLD|LATERAL RAISE|UPRIGHT ROW|FACE PULL|REVERSE FLYE|REVERSE PEC\b/.test(n)) return 'Shoulders';
  if (/\bBENCH PRESS|INCLINE PRESS|CHEST|PEC DECK|FLYE|FLY\b/.test(n)) return 'Chest';
  if (/\bROW|PULL-?UP|PULLDOWN|LAT PULL|PULL-OVER|T[- ]BAR\b/.test(n)) return 'Back';
  if (/\bABDUCTION|LEG SWING|LEG RAISE|CRUNCH|PLANK\b/.test(n)) return 'Core';
  return 'Glutes';
}

// Pull the largest number out of a "10 reps", "12-15 reps", "8 each leg",
// or "12 reps every minute for 10 minutes" string. EMOM-style "12 reps
// every minute" should plan 12, not 10.
function parsePlannedReps(repText) {
  if (!repText) return 10;
  const s = String(repText);
  // Prefer the first "N reps" mention.
  const repsMatch = s.match(/(\d+)\s*(?:-\s*(\d+))?\s*reps?/i);
  if (repsMatch) return Number(repsMatch[2] || repsMatch[1]) || 10;
  const numMatch = s.match(/(\d+)/);
  return numMatch ? Number(numMatch[1]) : 10;
}

function setTypeFor(group) {
  if (!group) return 'straight';
  return /superset/i.test(String(group)) ? 'superset' : 'straight';
}

// "3 rounds" → 3; "Perform once / 10-minute EMOM" → 1. Fall back to row's
// Set Volume Count if Rounds/Sets is empty/unparseable.
function setCountFor(row) {
  const rs = String(row['Rounds/Sets'] || '');
  const m = rs.match(/(\d+)\s*round/i);
  if (m) return Number(m[1]);
  if (/once/i.test(rs)) return 1;
  const svc = Number(row['Set Volume Count']);
  if (Number.isFinite(svc) && svc > 0) return svc;
  return 1;
}

async function ensureSchema(client) {
  // Defensive — these are also added in initDb but the migration may run
  // against an older snapshot.
  await client.query(`ALTER TABLE templates           ADD COLUMN IF NOT EXISTS prehab_template_id INT`);
  await client.query(`ALTER TABLE templates           ADD COLUMN IF NOT EXISTS is_prehab BOOLEAN DEFAULT FALSE`);
  await client.query(`ALTER TABLE template_exercises  ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT ''`);
  await client.query(`ALTER TABLE template_exercises  ADD COLUMN IF NOT EXISTS program_notes TEXT DEFAULT ''`);
  await client.query(`ALTER TABLE template_exercises  ADD COLUMN IF NOT EXISTS rep_range TEXT DEFAULT ''`);
  await client.query(`ALTER TABLE template_exercises  ADD COLUMN IF NOT EXISTS exercise_description TEXT DEFAULT ''`);
}

async function run() {
  const wb = xlsx.readFile(XLSX_PATH);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Workout Data'], { defval: '' });
  if (!rows.length) throw new Error('Workout Data sheet is empty');

  // Group rows by (week, day). Skip header/marker rows that have no Exercise.
  const byKey = new Map();
  for (const r of rows) {
    if (!r.Exercise || !r.Week || !r.Day) continue;
    const key = `${r.Week}|${r.Day}`;
    if (!byKey.has(key)) {
      byKey.set(key, { week: Number(r.Week), day: String(r.Day).trim(), workout: String(r.Workout || '').trim(), rows: [] });
    }
    byKey.get(key).rows.push(r);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSchema(client);

    // 1. Find or create the program row.
    const { rows: existing } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );
    let programId;
    if (existing.length) {
      programId = existing[0].id;
      await client.query(
        `UPDATE programs SET description = $1, sort_order = $2, program_type = $3, program_details = $4 WHERE id = $5`,
        [DESCRIPTIONS[0], SORT_ORDER, PROGRAM_TYPE, JSON.stringify(PROGRAM_DETAILS), programId]
      );
      console.log(`Program already exists (id=${programId}); details refreshed.`);
    } else {
      const { rows: [p] } = await client.query(
        `INSERT INTO programs (user_id, name, description, sort_order, program_type, program_details)
         VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id`,
        [PROGRAM_NAME, DESCRIPTIONS[0], SORT_ORDER, PROGRAM_TYPE, JSON.stringify(PROGRAM_DETAILS)]
      );
      programId = p.id;
      console.log(`Created program "${PROGRAM_NAME}" (id=${programId}).`);
    }

    // 2. Display abbreviation upsert.
    await client.query(
      `INSERT INTO program_name_abbreviations (full_name, short_name)
       VALUES ($1, $2)
       ON CONFLICT (full_name) DO UPDATE SET short_name = EXCLUDED.short_name`,
      [PROGRAM_NAME, SHORT_NAME]
    );

    // 3. Ensure all referenced exercises exist in the master library.
    const allExercises = new Map();
    for (const grp of byKey.values()) {
      for (const r of grp.rows) allExercises.set(r.Exercise, muscleFor(r.Exercise));
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

    // 4. Wipe any existing templates for this program.
    const { rowCount: deleted } = await deleteLibraryProgramTemplatesWithGuard(
      client, programId, { migrationName: 'add-katie-sonier-glute-building' }
    );
    if (deleted) console.log(`Cleared ${deleted} stale templates.`);

    // 5. Build 6 weeks × 7 days = 42 templates.
    //    Schedule: Sun rest · Mon W · Tue rest · Wed W · Thu rest · Fri W · Sat rest
    //    Slot 0..6 = Sun..Sat. Mon=1, Wed=3, Fri=5.
    const SLOT_TO_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const WORKOUT_DAYS = new Set(['Monday', 'Wednesday', 'Friday']);

    let sortOrder = 0;
    let templatesCreated = 0;
    for (let week = 1; week <= 6; week++) {
      for (let slot = 0; slot < 7; slot++) {
        const dayName = SLOT_TO_DAY[slot];
        if (!WORKOUT_DAYS.has(dayName)) {
          await client.query(
            `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
             VALUES (NULL, $1, $2, $3, TRUE, $4)`,
            [programId, 'Rest', 'Recovery day.', sortOrder++]
          );
          continue;
        }

        const grp = byKey.get(`${week}|${dayName}`);
        if (!grp) {
          // Shouldn't happen for a complete xlsx, but fall back to rest.
          await client.query(
            `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
             VALUES (NULL, $1, $2, $3, TRUE, $4)`,
            [programId, 'Rest', 'Recovery day (xlsx data missing).', sortOrder++]
          );
          continue;
        }

        const templateName = `Week ${week} · ${dayName}`;
        const { rows: [tpl] } = await client.query(
          `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
           VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id`,
          [programId, templateName, 'Glute-focused training. Master technique, then push the working sets near failure.', sortOrder++]
        );
        templatesCreated++;

        let exOrder = 0;
        for (const r of grp.rows) {
          const setType = setTypeFor(r.Group);
          const setCount = setCountFor(r);
          const repPrescription = String(r['Reps / Prescription'] || '').trim();
          const plannedReps = parsePlannedReps(repPrescription);

          // exercise_description: short header line — group/superset label,
          // rounds, prescription, then any per-set Notes from xlsx column J.
          const descParts = [];
          if (r.Group) descParts.push(String(r.Group).trim());
          if (r['Rounds/Sets']) descParts.push(String(r['Rounds/Sets']).trim());
          if (repPrescription) descParts.push(repPrescription);
          const noteJ = String(r.Notes || '').trim();
          if (noteJ) descParts.push(noteJ);
          const exerciseDescription = descParts.join(' · ');

          // program_notes (column "Session Notes")
          const sessionNotes = String(r['Session Notes'] || '').trim();

          const thisOrder = exOrder++;
          for (let s = 1; s <= setCount; s++) {
            await client.query(
              `INSERT INTO template_exercises
                (template_id, name, set_type, set_number, planned_reps, suggested_weight,
                 sort_order, rep_range, exercise_description, video_url, program_notes)
               VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, '', $9)`,
              [tpl.id, r.Exercise, setType, s, plannedReps, thisOrder, repPrescription, exerciseDescription, sessionNotes]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Created ${templatesCreated} workout templates for "${PROGRAM_NAME}".`);
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
