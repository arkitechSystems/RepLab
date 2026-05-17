// Path A: Exercise library cleanup migration (2026-05-17)
//
// Consumes:
//   server/migrations/data/duplicates-to-convert.json
//   server/migrations/data/new-muscle-group.json
//
// For each "Duplicates to Convert" row (source_id, target_id):
//   1) Look up source + target by id in the exercises table.
//      Validate: both exist, different ids, source has a unique name in DB,
//      target has a unique name in DB.
//   2) Rename references in three string-keyed tables:
//        template_exercises.name        (every program slot)
//        session_entries.exercise_name  (every historical logged set)
//   3) Merge personal_bests per-user:
//        among rows with name in {source_name, target_name},
//        keep the heaviest weight, tiebreak on reps, final tiebreak prefer
//        any row already on target_name; delete the others; rename the
//        survivor to target_name if it was still on source_name.
//   4) DELETE FROM exercises WHERE id = source_id.
//
// For each "New Muscle Group" row (id, new_group):
//   UPDATE exercises SET muscle_group = new_group WHERE id = $id
//
// Defaults to dry-run. Pass --commit to actually execute.
//
// Run:
//   Dry-run:  node --env-file=server/.env server/migrations/exercise-cleanup-2026-05-17.mjs
//   Commit:   node --env-file=server/.env server/migrations/exercise-cleanup-2026-05-17.mjs --commit
//
// Output:
//   - Stdout: progress + summary counts
//   - server/migrations/data/exercise-cleanup-2026-05-17-report.md (full report)

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pool from '../dbPool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const REPORT_PATH = path.join(DATA_DIR, 'exercise-cleanup-2026-05-17-report.md');

const COMMIT = process.argv.includes('--commit');

// Apple-style "known muscle groups" — for validation warnings on Sheet 2.
const KNOWN_MUSCLE_GROUPS = new Set([
  'Chest', 'Shoulders', 'Traps', 'Biceps', 'Back', 'Triceps',
  'Quads', 'Glutes', 'Hamstrings', 'Calves', 'Core', 'Forearms', 'Other',
]);

function log(...args) {
  console.log(...args);
}

async function loadJson(file) {
  const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
  return JSON.parse(raw);
}

async function getCurrentExercises(client) {
  const { rows } = await client.query(
    'SELECT id, name, muscle_group, is_custom FROM exercises ORDER BY id'
  );
  return rows;
}

// Build helper lookups for validation.
function indexExercises(rows) {
  const byId = new Map();
  const namesLower = new Map(); // lowercase name → [ids] (to detect dup names)
  for (const r of rows) {
    byId.set(r.id, r);
    const key = String(r.name).trim().toLowerCase();
    if (!namesLower.has(key)) namesLower.set(key, []);
    namesLower.get(key).push(r.id);
  }
  return { byId, namesLower };
}

// ---------- Validation ----------

function validateDuplicates(duplicates, { byId, namesLower }) {
  const errors = [];
  const warnings = [];
  // Two output buckets: redirect conversions (source → target) and outright
  // deletions (convert_to == "DELETE").
  const planned = []; // { sourceId, sourceName, targetId, targetName, sameName }
  const deletes = []; // { sourceId, sourceName }
  const sourceIdsSeen = new Set();
  // Group source rows by lowercase name so we can validate that name
  // collisions inside the spreadsheet all target the same exercise.
  const sourcesByName = new Map(); // name → [{ sourceId, targetId, isDelete, rowIdx }]

  // First pass — collect every row, light validation.
  const parsed = [];
  for (let i = 0; i < duplicates.length; i++) {
    const row = duplicates[i];
    const rowLabel = `Duplicates row ${i + 1} (id=${row.id})`;
    const sourceId = Number(row.id);
    const rawTarget = String(row.convert_to ?? '').trim();
    const isDelete = /^delete$/i.test(rawTarget);
    const targetId = isDelete ? null : Number(rawTarget);

    if (!Number.isFinite(sourceId) || sourceId <= 0) {
      errors.push(`${rowLabel}: invalid source id "${row.id}"`);
      continue;
    }
    if (!isDelete && (!Number.isFinite(targetId) || targetId <= 0)) {
      errors.push(`${rowLabel}: invalid target id "${row.convert_to}"`);
      continue;
    }
    if (!isDelete && sourceId === targetId) {
      warnings.push(`${rowLabel}: source == target (no-op, skipping)`);
      continue;
    }
    if (sourceIdsSeen.has(sourceId)) {
      errors.push(`${rowLabel}: source id ${sourceId} appears multiple times`);
      continue;
    }
    sourceIdsSeen.add(sourceId);

    const source = byId.get(sourceId);
    if (!source) {
      warnings.push(`${rowLabel}: source id ${sourceId} not found in DB (skipping)`);
      continue;
    }
    let target = null;
    if (!isDelete) {
      target = byId.get(targetId);
      if (!target) {
        errors.push(`${rowLabel}: target id ${targetId} not found in DB`);
        continue;
      }
    }

    const sourceNameKey = source.name.trim().toLowerCase();
    parsed.push({ rowLabel, sourceId, source, targetId, target, isDelete, sourceNameKey });
    if (!sourcesByName.has(sourceNameKey)) sourcesByName.set(sourceNameKey, []);
    sourcesByName.get(sourceNameKey).push({ sourceId, targetId, isDelete, rowLabel });
  }

  // Second pass — validate name collisions, build planned/deletes.
  for (const p of parsed) {
    const collidingIdsInDb = namesLower.get(p.sourceNameKey) || [];
    const collidingSourceRows = sourcesByName.get(p.sourceNameKey) || [];

    if (collidingIdsInDb.length > 1) {
      // Multiple DB rows share this name. Safe only if every DB row with this
      // name is itself a source in this batch AND every source-row for this
      // name has the same target (or all are DELETE).
      const inBatchIds = new Set(collidingSourceRows.map((r) => r.sourceId));
      const everyDbIdIsSource = collidingIdsInDb.every((id) => inBatchIds.has(id));
      const distinctTargets = new Set(collidingSourceRows.map((r) => r.isDelete ? 'DELETE' : r.targetId));

      if (!everyDbIdIsSource) {
        warnings.push(`${p.rowLabel}: source name "${p.source.name}" collides with another DB row not in the duplicates sheet (ids in DB: ${collidingIdsInDb.join(', ')}); skipping to avoid orphaning the non-source row`);
        continue;
      }
      if (distinctTargets.size > 1) {
        errors.push(`${p.rowLabel}: source name "${p.source.name}" has colliding source rows with different targets (${[...distinctTargets].join(', ')}); cannot safely string-rename`);
        continue;
      }
      // Safe collision — all colliding DB rows share the same target. Each
      // source row still proceeds; the string-rename query runs once per
      // source but is idempotent (subsequent runs hit zero rows).
    }

    if (p.isDelete) {
      deletes.push({ sourceId: p.sourceId, sourceName: p.source.name });
    } else {
      const targetNameKey = p.target.name.trim().toLowerCase();
      const sameName = p.sourceNameKey === targetNameKey;
      planned.push({
        sourceId: p.sourceId,
        sourceName: p.source.name,
        targetId: p.targetId,
        targetName: p.target.name,
        sameName,
      });
    }
  }

  // Detect redirect chains: target id is also a source.
  for (const p of planned) {
    if (sourceIdsSeen.has(p.targetId)) {
      errors.push(`Chain detected: target id ${p.targetId} (${p.targetName}) is itself a source in another row`);
    }
  }

  return { errors, warnings, planned, deletes };
}

function validateMuscleGroups(muscleGroup, { byId }) {
  const errors = [];
  const warnings = [];
  const planned = []; // { id, currentMuscleGroup, newMuscleGroup }

  for (let i = 0; i < muscleGroup.length; i++) {
    const row = muscleGroup[i];
    const rowLabel = `Muscle Group row ${i + 1} (id=${row.id})`;
    const id = Number(row.id);
    const newGroup = row.new_group ? String(row.new_group).trim() : '';

    if (!Number.isFinite(id) || id <= 0) {
      errors.push(`${rowLabel}: invalid id "${row.id}"`);
      continue;
    }
    if (!newGroup) {
      warnings.push(`${rowLabel}: empty new_group (skipping)`);
      continue;
    }
    if (!KNOWN_MUSCLE_GROUPS.has(newGroup)) {
      warnings.push(`${rowLabel}: new_group "${newGroup}" not in known set (will apply anyway)`);
    }
    const exercise = byId.get(id);
    if (!exercise) {
      warnings.push(`${rowLabel}: id ${id} not found in DB (skipping)`);
      continue;
    }
    if (exercise.muscle_group === newGroup) {
      // Already correct, skip silently.
      continue;
    }
    planned.push({ id, currentMuscleGroup: exercise.muscle_group, newMuscleGroup: newGroup, name: exercise.name });
  }

  return { errors, warnings, planned };
}

// ---------- Counts (dry-run preview of what each plan row would touch) ----------

async function countAffected(client, sourceName) {
  // Three string-keyed tables to inspect.
  const queries = [
    'SELECT COUNT(*)::int AS n FROM template_exercises WHERE LOWER(name) = LOWER($1)',
    'SELECT COUNT(*)::int AS n FROM session_entries WHERE LOWER(exercise_name) = LOWER($1)',
    'SELECT COUNT(*)::int AS n FROM personal_bests WHERE LOWER(exercise_name) = LOWER($1)',
  ];
  const [te, se, pb] = await Promise.all(queries.map((q) => client.query(q, [sourceName])));
  return { template_exercises: te.rows[0].n, session_entries: se.rows[0].n, personal_bests: pb.rows[0].n };
}

// ---------- Mutation per plan row ----------

async function applyDuplicateConversion(client, plan) {
  // 1. Rename template_exercises + session_entries (idempotent string updates).
  let teRenamed = 0;
  let seRenamed = 0;
  if (!plan.sameName) {
    const teRes = await client.query(
      'UPDATE template_exercises SET name = $1 WHERE LOWER(name) = LOWER($2)',
      [plan.targetName, plan.sourceName]
    );
    teRenamed = teRes.rowCount;
    const seRes = await client.query(
      'UPDATE session_entries SET exercise_name = $1 WHERE LOWER(exercise_name) = LOWER($2)',
      [plan.targetName, plan.sourceName]
    );
    seRenamed = seRes.rowCount;
  }

  // 2. Merge personal_bests per-user.
  //    Window function picks the best row per user across {source, target} names.
  //    All non-best rows are deleted; the survivor is renamed to target if it
  //    was still on source. tiebreak: weight desc -> reps desc -> prefer target name.
  const mergeRes = await client.query(
    `
    WITH ranked AS (
      SELECT id,
             user_id,
             exercise_name,
             best_weight,
             best_reps,
             ROW_NUMBER() OVER (
               PARTITION BY user_id
               ORDER BY best_weight DESC NULLS LAST,
                        best_reps DESC NULLS LAST,
                        CASE WHEN LOWER(exercise_name) = LOWER($2) THEN 0 ELSE 1 END
             ) AS rn
      FROM personal_bests
      WHERE LOWER(exercise_name) IN (LOWER($1), LOWER($2))
    ),
    losers AS (
      DELETE FROM personal_bests pb
      USING ranked r
      WHERE pb.id = r.id AND r.rn > 1
      RETURNING pb.id
    )
    SELECT
      (SELECT COUNT(*)::int FROM losers) AS pbs_deleted,
      (SELECT COUNT(*)::int FROM ranked WHERE rn = 1 AND LOWER(exercise_name) = LOWER($1)) AS pbs_to_rename
    `,
    [plan.sourceName, plan.targetName]
  );
  const pbsDeleted = mergeRes.rows[0].pbs_deleted || 0;
  const pbsToRename = mergeRes.rows[0].pbs_to_rename || 0;
  let pbRenamed = 0;
  if (!plan.sameName) {
    const renameRes = await client.query(
      'UPDATE personal_bests SET exercise_name = $1 WHERE LOWER(exercise_name) = LOWER($2)',
      [plan.targetName, plan.sourceName]
    );
    pbRenamed = renameRes.rowCount;
  }

  // 3. Delete the source exercise from the master library.
  const delRes = await client.query('DELETE FROM exercises WHERE id = $1', [plan.sourceId]);
  const exDeleted = delRes.rowCount;

  return { teRenamed, seRenamed, pbsDeleted, pbsToRename, pbRenamed, exDeleted };
}

// DELETE handler: convert_to == "DELETE" means drop the exercise outright,
// including every string reference to it. User explicitly OK'd "fine with
// anything that gets deleted" — single-user pre-launch state, history loss
// is acceptable. Returns the row counts touched.
async function applyDuplicateDelete(client, plan) {
  const teRes = await client.query(
    'DELETE FROM template_exercises WHERE LOWER(name) = LOWER($1)',
    [plan.sourceName]
  );
  const seRes = await client.query(
    'DELETE FROM session_entries WHERE LOWER(exercise_name) = LOWER($1)',
    [plan.sourceName]
  );
  const pbRes = await client.query(
    'DELETE FROM personal_bests WHERE LOWER(exercise_name) = LOWER($1)',
    [plan.sourceName]
  );
  const exRes = await client.query('DELETE FROM exercises WHERE id = $1', [plan.sourceId]);
  return {
    teDeleted: teRes.rowCount,
    seDeleted: seRes.rowCount,
    pbDeleted: pbRes.rowCount,
    exDeleted: exRes.rowCount,
  };
}

async function applyMuscleGroupChange(client, plan) {
  const res = await client.query(
    'UPDATE exercises SET muscle_group = $1 WHERE id = $2',
    [plan.newMuscleGroup, plan.id]
  );
  return { updated: res.rowCount };
}

// ---------- Main ----------

async function main() {
  const startedAt = new Date();
  log(`\n[exercise-cleanup] ${COMMIT ? 'COMMIT' : 'DRY-RUN'} mode  ·  ${startedAt.toISOString()}`);

  const duplicates = await loadJson('duplicates-to-convert.json');
  const muscleGroup = await loadJson('new-muscle-group.json');
  log(`[exercise-cleanup] loaded ${duplicates.length} duplicates rows, ${muscleGroup.length} muscle group rows`);

  const client = await pool.connect();
  const report = [];
  const push = (line) => { report.push(line); };

  push(`# Exercise Library Cleanup Report — ${startedAt.toISOString()}`);
  push('');
  push(`- Mode: **${COMMIT ? 'COMMIT' : 'DRY-RUN'}**`);
  push(`- Source spreadsheet: \`_marketing/replab-exercise-library-2026-05-17 (Conversion).xlsx\``);
  push(`- Duplicates rows: ${duplicates.length}`);
  push(`- Muscle group rows: ${muscleGroup.length}`);
  push('');

  try {
    await client.query('BEGIN');

    // ----- Validate against current DB state -----
    const currentExercises = await getCurrentExercises(client);
    const idx = indexExercises(currentExercises);
    log(`[exercise-cleanup] current DB has ${currentExercises.length} exercises`);
    push(`## Pre-state\n\n- Master exercises in DB: ${currentExercises.length}`);
    push('');

    const dupValidation = validateDuplicates(duplicates, idx);
    const mgValidation = validateMuscleGroups(muscleGroup, idx);

    push('## Validation — Duplicates');
    push(`- Planned conversions: ${dupValidation.planned.length}`);
    push(`- Planned outright deletes: ${dupValidation.deletes.length}`);
    push(`- Errors: ${dupValidation.errors.length}`);
    push(`- Warnings: ${dupValidation.warnings.length}`);
    if (dupValidation.errors.length) {
      push('');
      push('### Errors');
      for (const e of dupValidation.errors) push(`- ${e}`);
    }
    if (dupValidation.warnings.length) {
      push('');
      push('### Warnings');
      for (const w of dupValidation.warnings) push(`- ${w}`);
    }
    push('');

    push('## Validation — New Muscle Group');
    push(`- Planned updates: ${mgValidation.planned.length}`);
    push(`- Errors: ${mgValidation.errors.length}`);
    push(`- Warnings: ${mgValidation.warnings.length}`);
    if (mgValidation.errors.length) {
      push('');
      push('### Errors');
      for (const e of mgValidation.errors) push(`- ${e}`);
    }
    if (mgValidation.warnings.length) {
      push('');
      push('### Warnings');
      for (const w of mgValidation.warnings) push(`- ${w}`);
    }
    push('');

    if (dupValidation.errors.length > 0 || mgValidation.errors.length > 0) {
      log('[exercise-cleanup] HARD ERRORS — aborting before any mutation');
      push('## Aborted — hard errors above');
      throw new Error('Validation hard errors — see report');
    }

    // ----- Preview / Apply duplicates -----
    push('## Duplicates Conversion');
    push('');
    push('| # | Source ID | Source Name | Target ID | Target Name | TE renamed | SE renamed | PBs deleted | PBs renamed |');
    push('|---|---|---|---|---|---|---|---|---|');

    let dupTotals = { teRenamed: 0, seRenamed: 0, pbsDeleted: 0, pbRenamed: 0, exDeleted: 0 };
    for (let i = 0; i < dupValidation.planned.length; i++) {
      const plan = dupValidation.planned[i];
      if (!COMMIT) {
        // Dry-run: just count affected rows.
        const counts = await countAffected(client, plan.sourceName);
        push(`| ${i + 1} | ${plan.sourceId} | ${plan.sourceName} | ${plan.targetId} | ${plan.targetName} | ${counts.template_exercises} (would rename) | ${counts.session_entries} (would rename) | (merge preview not run in dry-run) | ${counts.personal_bests} (max would rename) |`);
      } else {
        const result = await applyDuplicateConversion(client, plan);
        dupTotals.teRenamed += result.teRenamed;
        dupTotals.seRenamed += result.seRenamed;
        dupTotals.pbsDeleted += result.pbsDeleted;
        dupTotals.pbRenamed += result.pbRenamed;
        dupTotals.exDeleted += result.exDeleted;
        push(`| ${i + 1} | ${plan.sourceId} | ${plan.sourceName} | ${plan.targetId} | ${plan.targetName} | ${result.teRenamed} | ${result.seRenamed} | ${result.pbsDeleted} | ${result.pbRenamed} |`);
      }
      if ((i + 1) % 25 === 0) {
        log(`[exercise-cleanup] processed ${i + 1}/${dupValidation.planned.length} duplicate rows`);
      }
    }
    push('');
    if (COMMIT) {
      push(`**Totals:** template_exercises renamed=${dupTotals.teRenamed}, session_entries renamed=${dupTotals.seRenamed}, personal_bests deleted=${dupTotals.pbsDeleted}, personal_bests renamed=${dupTotals.pbRenamed}, exercises deleted=${dupTotals.exDeleted}`);
    }
    push('');

    // ----- Preview / Apply outright deletes (convert_to == "DELETE") -----
    if (dupValidation.deletes.length > 0) {
      push('## Outright Deletes (convert_to = "DELETE")');
      push('');
      push('| # | Source ID | Source Name | TE deleted | SE deleted | PB deleted | Ex deleted |');
      push('|---|---|---|---|---|---|---|');
      const delTotals = { teDeleted: 0, seDeleted: 0, pbDeleted: 0, exDeleted: 0 };
      for (let i = 0; i < dupValidation.deletes.length; i++) {
        const plan = dupValidation.deletes[i];
        if (!COMMIT) {
          const counts = await countAffected(client, plan.sourceName);
          push(`| ${i + 1} | ${plan.sourceId} | ${plan.sourceName} | ${counts.template_exercises} (would delete) | ${counts.session_entries} (would delete) | ${counts.personal_bests} (would delete) | 1 (would delete) |`);
        } else {
          const result = await applyDuplicateDelete(client, plan);
          delTotals.teDeleted += result.teDeleted;
          delTotals.seDeleted += result.seDeleted;
          delTotals.pbDeleted += result.pbDeleted;
          delTotals.exDeleted += result.exDeleted;
          push(`| ${i + 1} | ${plan.sourceId} | ${plan.sourceName} | ${result.teDeleted} | ${result.seDeleted} | ${result.pbDeleted} | ${result.exDeleted} |`);
        }
      }
      push('');
      if (COMMIT) push(`**Totals:** template_exercises deleted=${delTotals.teDeleted}, session_entries deleted=${delTotals.seDeleted}, personal_bests deleted=${delTotals.pbDeleted}, exercises deleted=${delTotals.exDeleted}`);
      push('');
    }

    // ----- Preview / Apply muscle group changes -----
    push('## Muscle Group Reassignments');
    push('');
    push('| # | ID | Name | From | To | Updated |');
    push('|---|---|---|---|---|---|');

    let mgUpdated = 0;
    for (let i = 0; i < mgValidation.planned.length; i++) {
      const plan = mgValidation.planned[i];
      if (!COMMIT) {
        push(`| ${i + 1} | ${plan.id} | ${plan.name} | ${plan.currentMuscleGroup} | ${plan.newMuscleGroup} | (would update 1) |`);
      } else {
        const result = await applyMuscleGroupChange(client, plan);
        mgUpdated += result.updated;
        push(`| ${i + 1} | ${plan.id} | ${plan.name} | ${plan.currentMuscleGroup} | ${plan.newMuscleGroup} | ${result.updated} |`);
      }
    }
    push('');
    if (COMMIT) push(`**Totals:** exercises muscle_group updated=${mgUpdated}`);
    push('');

    // ----- Post-state -----
    const post = await getCurrentExercises(client);
    push('## Post-state');
    push(`- Master exercises after run: ${post.length}`);
    push(`- Delta: ${post.length - currentExercises.length} (negative = removed duplicates)`);
    push('');

    if (COMMIT) {
      await client.query('COMMIT');
      log('[exercise-cleanup] COMMITTED');
    } else {
      await client.query('ROLLBACK');
      log('[exercise-cleanup] DRY-RUN — rolled back, no changes persisted');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    log('[exercise-cleanup] FAILED — rolled back:', err.message);
    push('');
    push('## FAILURE');
    push('```');
    push(err.stack || err.message);
    push('```');
    process.exitCode = 1;
  } finally {
    client.release();
    await fs.writeFile(REPORT_PATH, report.join('\n') + '\n');
    log(`[exercise-cleanup] report written to ${REPORT_PATH}`);
  }
}

await main();
await pool.end();
