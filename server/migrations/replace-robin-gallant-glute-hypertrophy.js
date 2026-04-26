// Replaces Robin Gallant's Intensive Max Glute Hypertrophy Program with the
// full xlsx-driven dataset (4 weeks × 5 workout days), pulls the Prehabilitation
// sheet into 2 prehab templates (Lower Body + Upper Body), and stores
// Description 1-5 + Schedule 1-6 from the Program Description sheet on
// program_details for the Program Details accordion.
//
// Source: client/public/Workouts/Robin Gallant's Intensive Max Glute
// Hypertrophy Program.xlsx
//
// Schedule (per week): 2 days on, 1 day off, 3 days on, 1 day off
//   Sun: Day 1 (LB / Glutes)
//   Mon: Day 2 (UB / Delts)
//   Tue: REST
//   Wed: Day 3 (LB / Glutes)
//   Thu: Day 4 (UB)
//   Fri: Day 5 (LB / Glutes)
//   Sat: REST
//
// Per-exercise data captured from Workout Data sheet:
//   Column P (Notes)                 → exercise_description
//   Column Q (Failure / Workout Note) → program_notes (renders at bottom of card)
//   Column R (Video Link)            → video_url (overrides demo button target)
//
// New columns added idempotently here (also added to initDb.js for fresh DBs):
//   templates.prehab_template_id INT
//   templates.is_prehab BOOLEAN DEFAULT FALSE
//   template_exercises.video_url TEXT DEFAULT ''
//   template_exercises.program_notes TEXT DEFAULT ''
//
// Run with:
//   node --env-file=server/.env server/migrations/replace-robin-gallant-glute-hypertrophy.js
//
// Idempotent — deletes existing templates for the program before rebuilding.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';
import pool from '../dbPool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROGRAM_NAME = "Robin Gallant's Intensive Max Glute Hypertrophy";
const SORT_ORDER = 19;
const PROGRAM_TYPE = 'glute_focused';

const XLSX_PATH = path.resolve(
  __dirname, '..', '..',
  'client', 'public', 'Workouts',
  "Robin Gallant's Intensive Max Glute Hypertrophy Program.xlsx"
);

function muscleFor(name) {
  const n = String(name).toUpperCase();
  if (/\bCALF|CALVES\b/.test(n)) return 'Calves';
  if (/\bLEG CURL|HAMSTRING|RDL|ROMANIAN|AMERICAN DEADLIFT\b/.test(n)) return 'Hamstrings';
  if (/\bHIP THRUST|GLUTE|PULL[- ]THROUGH|FIRE HYDRANT|PRONE HIP|CLAM\b/.test(n)) return 'Glutes';
  if (/\bSQUAT|LUNGE|LEG EXTENSION|LEG PRESS|GOBLET|STEP[- ]?UP\b/.test(n)) return 'Quads';
  if (/\bDEADLIFT\b/.test(n)) return 'Hamstrings';
  if (/\bSHRUG\b/.test(n)) return 'Traps';
  if (/\bCURL\b/.test(n) && !/LEG CURL/.test(n)) return 'Biceps';
  if (/\bSKULL|TRICEPS|KICKBACK|PRESSDOWN|ROPE OVERHEAD|CLOSE.GRIP\b/.test(n)) return 'Triceps';
  if (/\bSHOULDER PRESS|MILITARY|ARNOLD|LATERAL RAISE|UPRIGHT ROW|FACE PULL|REVERSE FLYE|REVERSE PEC|YTW|ARM CIRCLE|SHOULDER\b/.test(n)) return 'Shoulders';
  if (/\bBENCH PRESS|INCLINE PRESS|CHEST|PEC DECK|FLYE|FLY\b/.test(n)) return 'Chest';
  if (/\bROW|PULL-?UP|PULLDOWN|LAT PULL|PULL-OVER|T[- ]BAR|SEAL ROW\b/.test(n)) return 'Back';
  if (/\bABDUCTION|LEG SWING|LEG RAISE\b/.test(n)) return 'Legs';
  return 'Other';
}

function parsePlannedReps(repRange) {
  if (!repRange) return 10;
  const matches = [...String(repRange).matchAll(/(\d+)(?:\s*[-–]\s*(\d+))?/g)];
  if (!matches.length) return 10;
  const last = matches[matches.length - 1];
  return Number(last[2] || last[1]) || 10;
}

// Strip trailing dual-link segments — xlsx column R sometimes lists two
// videos separated by " ; ". Take the first; ExerciseCard only renders one.
function firstVideoUrl(raw) {
  if (!raw) return '';
  const v = String(raw).split(/\s*;\s*/)[0].trim();
  // Defensive: only allow http(s) URLs.
  return /^https?:\/\//.test(v) ? v : '';
}

async function ensureSchema(client) {
  await client.query(`ALTER TABLE templates           ADD COLUMN IF NOT EXISTS prehab_template_id INT`);
  await client.query(`ALTER TABLE templates           ADD COLUMN IF NOT EXISTS is_prehab BOOLEAN DEFAULT FALSE`);
  await client.query(`ALTER TABLE template_exercises  ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT ''`);
  await client.query(`ALTER TABLE template_exercises  ADD COLUMN IF NOT EXISTS program_notes TEXT DEFAULT ''`);
}

async function run() {
  const wb = xlsx.readFile(XLSX_PATH);

  // --- Program description rows ---
  const descRowsRaw = xlsx.utils.sheet_to_json(wb.Sheets['Program Description'], { defval: '', header: 1 });
  const descMap = {};
  for (const row of descRowsRaw) {
    const [section, text] = row;
    if (typeof section === 'string' && text) descMap[section.trim()] = String(text).trim();
  }
  const descriptions = ['Description 1', 'Description 2', 'Description 3', 'Description 4', 'Description 5']
    .map((k) => descMap[k]).filter(Boolean);
  const schedules = ['Schedule 1', 'Schedule 2', 'Schedule 3', 'Schedule 4', 'Schedule 5', 'Schedule 6']
    .map((k) => descMap[k]).filter(Boolean);

  // --- Prehabilitation rows ---
  const prehabRowsRaw = xlsx.utils.sheet_to_json(wb.Sheets['Prehabilitation'], { defval: '' });
  const lowerPrehab = [], upperPrehab = [];
  for (const r of prehabRowsRaw) {
    if (!r.Exercise || /TOTAL TIME/i.test(r.Exercise)) continue;
    const target = r.Section === 'Upper Body' ? upperPrehab : lowerPrehab;
    target.push({
      name: r.Exercise,
      sets: Number(r.Sets) || 1,
      reps: r.Reps,
      notes: String(r.Notes || '').trim(),
      videoUrl: firstVideoUrl(r['Video Link']),
    });
  }

  // --- Workout Data rows, grouped by week + day ---
  const woRows = xlsx.utils.sheet_to_json(wb.Sheets['Workout Data'], { defval: '' });
  // Build per-(week, dayLabel) groups
  const byKey = new Map();
  for (const r of woRows) {
    if (!r.Exercise) continue; // Skip header divider rows
    const wk = Number(r.Week);
    if (!wk) continue;
    const day = String(r.Day).trim();
    const key = `${wk}|${day}`;
    if (!byKey.has(key)) {
      byKey.set(key, { week: wk, day, workoutTitle: String(r.Workout || '').trim(), rows: [] });
    }
    byKey.get(key).rows.push(r);
  }

  const PROGRAM_DETAILS = {
    Program: 'Intensive Max Glute Hypertrophy',
    Source: descMap['Source'] || "Robin Gallant's Intensive Max Glute Hypertrophy Program PDF",
    Author: 'Robin Gallant',
    'Main Goal': 'Hypertrophy (glute emphasis)',
    'Training Level': 'Intermediate',
    'Program Duration': '4 Weeks',
    'Days Per Week': '5 Days',
    'Time Per Workout': '60-90 Mins',
    Equipment: 'Barbell, Dumbbells, Cables, Machines',
    Overview: descriptions[0] || '',
    Descriptions: descriptions,
    Schedule: schedules,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureSchema(client);

    // 1. Find or create program. Refresh details either way.
    const { rows: existing } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );
    let programId;
    if (existing.length) {
      programId = existing[0].id;
      await client.query(
        `UPDATE programs SET description = $1, sort_order = $2, program_type = $3, program_details = $4 WHERE id = $5`,
        [PROGRAM_DETAILS.Overview, SORT_ORDER, PROGRAM_TYPE, JSON.stringify(PROGRAM_DETAILS), programId]
      );
      console.log(`Program already exists (id=${programId}); details refreshed.`);
    } else {
      const { rows: [p] } = await client.query(
        `INSERT INTO programs (user_id, name, description, sort_order, program_type, program_details)
         VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id`,
        [PROGRAM_NAME, PROGRAM_DETAILS.Overview, SORT_ORDER, PROGRAM_TYPE, JSON.stringify(PROGRAM_DETAILS)]
      );
      programId = p.id;
      console.log(`Created program "${PROGRAM_NAME}" (id=${programId}).`);
    }

    // 2. Ensure all referenced exercises exist in the master library.
    const allExercises = new Map();
    for (const list of [lowerPrehab, upperPrehab]) {
      for (const ex of list) allExercises.set(ex.name, muscleFor(ex.name));
    }
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

    // 3. Wipe all existing templates for this program.
    const { rowCount: deleted } = await client.query(
      'DELETE FROM templates WHERE program_id = $1', [programId]
    );
    if (deleted) console.log(`Cleared ${deleted} stale templates.`);

    // 4. Create the two prehab templates (sort_order high so they sit out of
    //    the visible weekly grid; is_prehab flag also tells the client to
    //    filter them from week views).
    async function insertPrehabTemplate(label, exercises, sortOrder) {
      const { rows: [tpl] } = await client.query(
        `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, is_prehab)
         VALUES (NULL, $1, $2, $3, FALSE, $4, TRUE) RETURNING id`,
        [programId, label, 'Optional warm-up routine. Activates target musculature before training.', sortOrder]
      );
      let exOrder = 0;
      for (const ex of exercises) {
        const setCount = Number(ex.sets) || 1;
        const plannedReps = parsePlannedReps(ex.reps);
        const repRange = String(ex.reps || '');
        const desc = String(ex.notes || '').trim();
        const thisOrder = exOrder++;
        for (let s = 1; s <= setCount; s++) {
          await client.query(
            `INSERT INTO template_exercises
              (template_id, name, set_type, set_number, planned_reps, suggested_weight,
               sort_order, rep_range, exercise_description, video_url, program_notes)
             VALUES ($1, $2, 'straight', $3, $4, 0, $5, $6, $7, $8, '')`,
            [tpl.id, ex.name, s, plannedReps, thisOrder, repRange, desc, ex.videoUrl || '']
          );
        }
      }
      return tpl.id;
    }
    const lowerPrehabId = await insertPrehabTemplate('Lower Body Prehab', lowerPrehab, 1000);
    const upperPrehabId = await insertPrehabTemplate('Upper Body Prehab', upperPrehab, 1001);
    console.log(`Created prehab templates: lower=${lowerPrehabId}, upper=${upperPrehabId}.`);

    // 5. Build 4 weeks × 7 days = 28 templates from the xlsx data.
    //    Day mapping per the schedule above: slot 0/3/5 = LB days, 1/4 = UB days,
    //    2/6 = REST. xlsx labels are "Day 1".."Day 5".
    const WEEKLY_PATTERN = ['Day 1', 'Day 2', null, 'Day 3', 'Day 4', 'Day 5', null];
    const PREHAB_FOR_TITLE = (title) => /UPPER BODY/i.test(title) ? upperPrehabId : lowerPrehabId;

    let sortOrder = 0;
    let templatesCreated = 0;
    for (let week = 1; week <= 4; week++) {
      for (let slot = 0; slot < 7; slot++) {
        const xlsxDay = WEEKLY_PATTERN[slot];
        if (xlsxDay === null) {
          await client.query(
            `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
             VALUES (NULL, $1, $2, $3, TRUE, $4)`,
            [programId, 'Rest', 'Recovery day.', sortOrder++]
          );
          continue;
        }
        const grp = byKey.get(`${week}|${xlsxDay}`);
        if (!grp) {
          // Should never happen — fall back to rest if a week-day is missing.
          await client.query(
            `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
             VALUES (NULL, $1, $2, $3, TRUE, $4)`,
            [programId, 'Rest', 'Recovery day (xlsx data missing for this slot).', sortOrder++]
          );
          continue;
        }

        const templateName = `Week ${week} · ${grp.workoutTitle}`;
        const templateDesc = `RPE-based work. Optional ${ /UPPER BODY/i.test(grp.workoutTitle) ? 'upper-body' : 'lower-body'} prehab available before this session.`;
        const prehabId = PREHAB_FOR_TITLE(grp.workoutTitle);
        const { rows: [tpl] } = await client.query(
          `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, prehab_template_id)
           VALUES (NULL, $1, $2, $3, FALSE, $4, $5) RETURNING id`,
          [programId, templateName, templateDesc, sortOrder++, prehabId]
        );
        templatesCreated++;

        let exOrder = 0;
        for (const ex of grp.rows) {
          const setCount = Number(ex.Sets) || 1;
          const repRange = String(ex.Reps || '');
          const plannedReps = parsePlannedReps(repRange);

          // exercise_description: RPE / Rest / Notes (column P), like Nippard PPL
          const parts = [];
          const rpe = String(ex.RPE ?? '').trim();
          if (rpe) parts.push(`RPE ${rpe}`);
          const rest = String(ex['Rest (min)'] ?? '').trim();
          if (rest) parts.push(`Rest ${rest} min`);
          const notesP = String(ex.Notes ?? '').trim();
          if (notesP) parts.push(notesP);
          const exerciseDescription = parts.join(' · ');

          // program_notes: column Q
          const failureQ = String(ex['Failure / Workout Note'] ?? '').trim();

          // video_url: column R (first link if multiple)
          const videoUrl = firstVideoUrl(ex['Video Link']);

          const thisOrder = exOrder++;
          for (let s = 1; s <= setCount; s++) {
            await client.query(
              `INSERT INTO template_exercises
                (template_id, name, set_type, set_number, planned_reps, suggested_weight,
                 sort_order, rep_range, exercise_description, video_url, program_notes)
               VALUES ($1, $2, 'straight', $3, $4, 0, $5, $6, $7, $8, $9)`,
              [tpl.id, ex.Exercise, s, plannedReps, thisOrder, repRange, exerciseDescription, videoUrl, failureQ]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Created ${templatesCreated} workout templates + 2 prehab templates for "${PROGRAM_NAME}".`);
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
