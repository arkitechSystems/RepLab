// Adds Jeff Nippard's Push Pull Legs (16-week hypertrophy program, 2 blocks
// × 8 weeks each, 6 workouts/week) to the library. Populates templates
// (112 = 16 weeks × 7 days, rest day on day 7), adds any missing exercises
// to the master library, and sets program_details + the `phase` column on
// every template so the Browse Library weekly view shows the block labels
// (same pattern Stoppani uses for Phase 1/Phase 2).
//
// Source: client/public/Workouts/Jeff Nippard's Push Pull Legs.xlsx
//
// Run with: node --env-file=server/.env server/migrations/add-nippard-push-pull-legs.js
// Idempotent — deletes existing templates for the program before rebuilding.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';
import pool from '../dbPool.js';
import {
  fetchLibraryProgramTemplates,
  replaceTemplateExercises,
  cascadeDeleteOrphanedLibraryTemplates,
} from './_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROGRAM_NAME = "Jeff Nippard's Push Pull Legs";
const SORT_ORDER = 20;
const PROGRAM_TYPE = 'hypertrophy';

const XLSX_PATH = path.resolve(
  __dirname, '..', '..',
  'client', 'public', 'Workouts',
  "Jeff Nippard's Push Pull Legs.xlsx"
);

const DETAILS = {
  Program: "Jeff Nippard's Legs/Push/Pull Hypertrophy Program",
  Source: 'Jeff Nippard',
  'Main Goal': 'Hypertrophy',
  'Training Level': 'Intermediate / Advanced',
  'Program Duration': '16 Weeks',
  'Days Per Week': '6 Days',
  'Time Per Workout': '60-90 Mins',
  Equipment: 'Barbell, Dumbbells, Cables, Machines, Bodyweight',
  Author: 'Jeff Nippard',
  Split: 'Legs / Push / Pull (6 workouts: Legs #1, Push #1, Pull #1, Legs #2, Push #2, Pull #2)',
  Overview:
    '16 total weeks across two 8-week blocks. Block 1 is a technique phase focused on building a solid foundation with form cues on every set. Block 2 is a peaking phase that intensifies volume and load. 6 workouts per week: Legs #1, Push #1, Pull #1, Legs #2, Push #2, Pull #2.',
};

// Strip "A1: " / "A2: " / etc. superset prefixes for the master library only.
// Templates keep the prefix so users see the superset grouping.
function cleanExerciseName(name) {
  return String(name).replace(/^[A-Z]\d+:\s*/, '').trim();
}

// Muscle-group heuristic. Ordered so more specific keywords win first.
function muscleFor(name) {
  const n = name.toUpperCase();
  if (/\bCALF|CALVES\b/.test(n)) return 'Calves';
  if (/\bLEG CURL|HAMSTRING|ROMANIAN|RDL\b/.test(n)) return 'Hamstrings';
  if (/\bHIP THRUST|\bGLUTE|PULL[- ]THROUGH|PULLTHROUGH|LATERAL BAND WALK\b/.test(n)) return 'Glutes';
  if (/\bSQUAT|LUNGE|LEG EXTENSION|LEG PRESS|GOBLET\b/.test(n)) return 'Quads';
  if (/\bDEADLIFT\b/.test(n)) return 'Hamstrings';
  if (/\bSHRUG\b/.test(n)) return 'Traps';
  if (/\bCURL\b/.test(n)) return 'Biceps';
  if (/\bSKULL|TRICEPS|KICKBACK|PRESSDOWN|ROPE OVERHEAD|CLOSE.GRIP\b/.test(n)) return 'Triceps';
  if (/\bDIP\b/.test(n)) return 'Triceps';
  if (/\bSHOULDER PRESS|MILITARY|ARNOLD|LATERAL RAISE|UPRIGHT ROW|FACE PULL|REVERSE FLYE|REVERSE PEC|EGYPTIAN\b/.test(n)) return 'Shoulders';
  if (/\bBENCH PRESS|CHEST|PEC DECK|FLYE|FLY\b/.test(n)) return 'Chest';
  if (/\bROW|PULL-?UP|PULLDOWN|LAT PULL|PULL-OVER|T[- ]BAR|SEAL ROW\b/.test(n)) return 'Back';
  if (/\bHYPEREXTENSION\b/.test(n)) return 'Back';
  if (/\bCRUNCH|PLANK|ROLLOUT|LEG RAISE|BICYCLE\b/.test(n)) return 'Core';
  return 'Other';
}

function parsePlannedReps(repRange) {
  if (!repRange) return 10;
  const match = String(repRange).match(/(\d+)(?:\s*[-–]\s*(\d+))?/);
  if (!match) return 10;
  return Number(match[2] || match[1]) || 10;
}

async function run() {
  const wb = xlsx.readFile(XLSX_PATH);
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['Workout Data'], { defval: '' });
  if (!rows.length) throw new Error('Workout Data sheet is empty');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find or create program
    const { rows: existing } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );
    let programId;
    if (existing.length) {
      programId = existing[0].id;
      await client.query(
        'UPDATE programs SET description = $1, sort_order = $2, program_type = $3, program_details = $4 WHERE id = $5',
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

    // 2. Ensure every exercise is in the master library (strip A1:/A2: prefix)
    const uniqueClean = new Map();
    for (const r of rows) {
      if (r['Row Type'] !== 'Exercise') continue;
      const clean = cleanExerciseName(r.Exercise);
      if (!uniqueClean.has(clean)) uniqueClean.set(clean, muscleFor(clean));
    }
    const { rows: existingExRows } = await client.query('SELECT LOWER(name) AS n FROM exercises');
    const existingEx = new Set(existingExRows.map((r) => r.n));
    let added = 0;
    for (const [name, muscle] of uniqueClean) {
      if (existingEx.has(name.toLowerCase())) continue;
      await client.query(
        'INSERT INTO exercises (name, muscle_group, is_custom) VALUES ($1, $2, FALSE)',
        [name, muscle]
      );
      added++;
    }
    console.log(`Exercises: ${added} added, ${uniqueClean.size - added} already present.`);

    // 3. Snapshot existing templates so we can UPDATE in place by sort_order
    //    (preserves PBs) and only cascade-delete sort_orders that vanish.
    const existingBySortOrder = await fetchLibraryProgramTemplates(client, programId);
    const newSortOrdersUsed = new Set();
    let updatedCount = 0;
    let insertedCount = 0;

    // 4. Group rows by (Overall Week, Day) — skip TOTAL SET VOLUME rows.
    const byDay = new Map();
    for (const r of rows) {
      if (r['Row Type'] !== 'Exercise') continue;
      const wk = Number(r['Overall Week']);
      const day = Number(r.Day);
      const key = `${wk}-${day}`;
      if (!byDay.has(key)) byDay.set(key, {
        week: wk,
        day,
        block: r.Block,
        workout: r.Workout,
        rows: [],
      });
      byDay.get(key).rows.push(r);
    }

    // Template name → block phase label (user wants "Block 1" / "Block 2" in the UI).
    const phaseFor = (block) => block === 'Block 1' ? 'Block 1' : 'Block 2';

    // 5. Build 16 weeks × 7 days = 112 templates, Day 7 = Rest.
    const exerciseColumns = [
      'name', 'set_type', 'set_number', 'planned_reps', 'suggested_weight',
      'sort_order', 'rep_range', 'exercise_description',
    ];

    async function upsertTemplate(sortOrder, fields, newExercises) {
      newSortOrdersUsed.add(sortOrder);
      const match = existingBySortOrder.get(sortOrder);
      let templateId;
      if (match) {
        // Match by sort_order to preserve PBs across re-runs.
        const { rows: [tpl] } = await client.query(
          `UPDATE templates
              SET name = $1, description = $2, is_rest = $3, sort_order = $4, phase = $5
            WHERE id = $6
            RETURNING id`,
          [fields.name, fields.description, fields.isRest, sortOrder, fields.phase, match.id]
        );
        templateId = tpl.id;
        updatedCount++;
      } else {
        const { rows: [tpl] } = await client.query(
          `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, phase)
           VALUES (NULL, $1, $2, $3, $4, $5, $6) RETURNING id`,
          [programId, fields.name, fields.description, fields.isRest, sortOrder, fields.phase]
        );
        templateId = tpl.id;
        insertedCount++;
      }
      await replaceTemplateExercises(client, templateId, newExercises, exerciseColumns);
      return templateId;
    }

    let sortOrder = 0;
    for (let week = 1; week <= 16; week++) {
      for (let day = 1; day <= 7; day++) {
        const block = week <= 8 ? 'Block 1' : 'Block 2';
        const phase = phaseFor(block);

        if (day === 7) {
          await upsertTemplate(
            sortOrder++,
            { name: 'Rest', description: 'Recovery day.', isRest: true, phase },
            []
          );
          continue;
        }

        const group = byDay.get(`${week}-${day}`);
        if (!group) {
          // Should never happen given the xlsx structure; fall back to rest.
          await upsertTemplate(
            sortOrder++,
            { name: 'Rest', description: 'Recovery day.', isRest: true, phase },
            []
          );
          continue;
        }

        const templateName = `Week ${week} · Day ${day} — ${group.workout}`;
        const description = `${block}. ${group.workout}.`;

        // Per-exercise sets. Program Notes (column N) → exercise_description,
        // along with RPE/%1RM and rest-range for quick reference on the card.
        const newExercises = [];
        let exOrder = 0;
        for (const ex of group.rows) {
          const setCount = Number(ex.Sets) || 1;
          const repRange = String(ex.Reps || '');
          const plannedReps = parsePlannedReps(repRange);
          const parts = [];
          const rpe = String(ex['RPE / %1RM'] || '').trim();
          if (rpe) parts.push(/^\d+%$/.test(rpe) ? rpe + ' 1RM' : 'RPE ' + rpe);
          const rest = String(ex.Rest || '').trim();
          if (rest) parts.push('Rest ' + rest);
          const notes = String(ex['Program Notes'] || '').trim();
          if (notes) parts.push(notes);
          const exerciseDescription = parts.join(' · ');
          const thisOrder = exOrder++;

          for (let s = 1; s <= setCount; s++) {
            newExercises.push({
              name: ex.Exercise,
              set_type: 'straight',
              set_number: s,
              planned_reps: plannedReps,
              suggested_weight: 0,
              sort_order: thisOrder,
              rep_range: repRange,
              exercise_description: exerciseDescription,
            });
          }
        }

        await upsertTemplate(
          sortOrder++,
          { name: templateName, description, isRest: false, phase },
          newExercises
        );
      }
    }

    // Sweep orphans — templates whose sort_order was not regenerated.
    const orphanIds = [];
    for (const [so, t] of existingBySortOrder) {
      if (!newSortOrdersUsed.has(so)) orphanIds.push(t.id);
    }
    if (orphanIds.length > 0) {
      await cascadeDeleteOrphanedLibraryTemplates(client, orphanIds, {
        migrationName: 'add-nippard-push-pull-legs',
      });
      console.log(`Removed ${orphanIds.length} orphaned templates (sort_order vanished from new payload).`);
    }

    await client.query('COMMIT');
    console.log(`Upserted ${sortOrder} templates for "${PROGRAM_NAME}" (${updatedCount} updated, ${insertedCount} inserted).`);
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
