// One-off master exercise library cleanup from Will's review sheet
// ("replab-exercise-library update 9.27.26.xlsx", Exercises tab), 2026-09-28.
//
// Reads a plan JSON (delete / consolidate / rename / muscle / video / hide /
// promote, keyed by exercises.id) and applies it in ONE transaction:
//   - promote:     custom → master library (created_by NULL, is_custom FALSE)
//   - rename:      exercises.name + every template/session/PR row linked to it
//   - consolidate: repoint template_exercises, session_entries and
//                  personal_bests from loser → winner (renaming them to the
//                  winner's name), merging PR rows that collide on weight
//                  (most reps wins, same rule as the app's PB upsert), then
//                  delete the loser
//   - delete:      remove the exercise from every program (template rows),
//                  then delete it; logged sets and PRs keep their names and
//                  lose the link (FK ON DELETE SET NULL)
//   - muscle / muscle-group rename (e.g. Cardio → Conditioning) / video / hide
// Template rows are matched by exercise_id, plus unlinked rows (exercise_id
// NULL) with the same name — otherwise the boot-time backfill
// (migrations/backfill-exercise-library.js) would re-create deleted or
// renamed names from leftover template rows.
//
// Dry run by default (everything runs, then ROLLBACK). Pass --apply to commit.
// Always writes a JSON backup of the four touched tables first.
//
//   node --env-file=server/.env server/scripts/exercise-library-cleanup-2026-09-28.js <plan.json> <backupDir> [--apply]

import fs from 'fs';
import path from 'path';
import pool from '../dbPool.js';

const [planPath, backupDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
if (!planPath || !backupDir) {
  console.error('Usage: exercise-library-cleanup-2026-09-28.js <plan.json> <backupDir> [--apply]');
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const num = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [Number(k), v]));
const deletes = plan.delete.map(Number);
const consolidate = num(plan.consolidate);
const rename = num(plan.rename);
const muscle = num(plan.muscle);
const video = num(plan.video);
const hide = plan.hide.map(Number);
const promote = Object.keys(plan.promote).map(Number);

const NOT_HEADER = 'COALESCE(is_section_header, FALSE) = FALSE';

async function backup() {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const t of ['exercises', 'template_exercises', 'session_entries', 'personal_bests']) {
    const { rows } = await pool.query(`SELECT * FROM ${t}`);
    const file = path.join(backupDir, `${stamp}-${t}.json`);
    fs.writeFileSync(file, JSON.stringify(rows));
    console.log(`backup ${t}: ${rows.length} rows → ${file}`);
  }
}

// Names referenced by templates that have no library row — exactly what the
// boot backfill would insert. Compared before/after to prove nothing returns.
async function backfillCandidates(client) {
  const { rows } = await client.query(`
    SELECT DISTINCT TRIM(te.name) AS name FROM template_exercises te
    WHERE ${NOT_HEADER} AND te.name IS NOT NULL AND TRIM(te.name) <> ''
      AND NOT EXISTS (SELECT 1 FROM exercises e WHERE LOWER(e.name) = LOWER(TRIM(te.name)))
    ORDER BY 1`);
  return rows.map((r) => r.name);
}

async function main() {
  await backup();
  const client = await pool.connect();
  const log = [];
  try {
    await client.query('BEGIN');

    const allIds = [...new Set([...deletes, ...Object.keys(consolidate).map(Number), ...Object.values(consolidate),
      ...Object.keys(rename).map(Number), ...Object.keys(muscle).map(Number), ...Object.keys(video).map(Number), ...hide, ...promote])];
    const { rows: exRows } = await client.query('SELECT * FROM exercises WHERE id = ANY($1::int[])', [allIds]);
    const ex = new Map(exRows.map((r) => [r.id, r]));

    // ── Validation ──
    const errors = [];
    for (const id of allIds) if (!ex.has(id)) errors.push(`exercise ${id} not found`);
    const removed = new Set([...deletes, ...Object.keys(consolidate).map(Number)]);
    for (const [l, w] of Object.entries(consolidate)) {
      if (Number(l) === w) errors.push(`${l} consolidates into itself`);
      if (removed.has(w)) errors.push(`${l} → ${w}, but ${w} is itself deleted/consolidated`);
    }
    for (const id of [...Object.keys(rename), ...Object.keys(muscle), ...Object.keys(video), ...hide, ...promote].map(Number)) {
      if (removed.has(id)) errors.push(`${id} is both removed and edited`);
    }
    for (const [id, name] of Object.entries(rename)) {
      const { rows } = await client.query(
        'SELECT id FROM exercises WHERE LOWER(name) = LOWER($1) AND created_by IS NULL AND id <> $2 AND NOT (id = ANY($3::int[]))',
        [name, Number(id), [...removed]]
      );
      if (rows.length) errors.push(`rename ${id} → "${name}" collides with master ${rows[0].id}`);
    }
    if (errors.length) throw new Error('Validation failed:\n  ' + errors.join('\n  '));

    const before = await backfillCandidates(client);

    await client.query('ALTER TABLE exercises ADD COLUMN IF NOT EXISTS hidden_from_library BOOLEAN NOT NULL DEFAULT FALSE');

    // ── Promote customs into the master library ──
    for (const id of promote) {
      await client.query('UPDATE exercises SET created_by = NULL, is_custom = FALSE WHERE id = $1', [id]);
      log.push(`promote  ${id} "${ex.get(id).name}" → master library`);
    }

    // ── Renames (before consolidations so winners carry their final name) ──
    for (const [idStr, newName] of Object.entries(rename)) {
      const id = Number(idStr);
      const oldName = ex.get(id).name;
      await client.query('UPDATE exercises SET name = $1 WHERE id = $2', [newName, id]);
      const te = await client.query(
        `UPDATE template_exercises SET name = $1, exercise_id = $2
         WHERE ${NOT_HEADER} AND (exercise_id = $2 OR (exercise_id IS NULL AND LOWER(TRIM(name)) = LOWER($3)))`,
        [newName, id, oldName]
      );
      const se = await client.query('UPDATE session_entries SET exercise_name = $1 WHERE exercise_id = $2', [newName, id]);
      const pb = await mergePRs(client, id, id, newName);
      ex.get(id).name = newName;
      log.push(`rename   ${id} "${oldName}" → "${newName}"  (program rows ${te.rowCount}, logged sets ${se.rowCount}, PRs ${pb})`);
    }

    // ── Consolidations ──
    for (const [lStr, w] of Object.entries(consolidate)) {
      const l = Number(lStr);
      const lName = ex.get(l).name;
      const wName = ex.get(w).name;
      const te = await client.query(
        `UPDATE template_exercises SET exercise_id = $1, name = $2
         WHERE ${NOT_HEADER} AND (exercise_id = $3 OR (exercise_id IS NULL AND LOWER(TRIM(name)) = LOWER($4)))`,
        [w, wName, l, lName]
      );
      const se = await client.query(
        'UPDATE session_entries SET exercise_id = $1, exercise_name = $2 WHERE exercise_id = $3',
        [w, wName, l]
      );
      const pb = await mergePRs(client, l, w, wName);
      await client.query('DELETE FROM exercises WHERE id = $1', [l]);
      log.push(`merge    ${l} "${lName}" → ${w} "${wName}"  (program rows ${te.rowCount}, logged sets ${se.rowCount}, PRs ${pb})`);
    }

    // ── Deletes ──
    for (const id of deletes) {
      const name = ex.get(id).name;
      const te = await client.query(
        `DELETE FROM template_exercises
         WHERE ${NOT_HEADER} AND (exercise_id = $1 OR (exercise_id IS NULL AND LOWER(TRIM(name)) = LOWER($2)))`,
        [id, name]
      );
      const { rows: [c] } = await client.query(
        `SELECT (SELECT COUNT(*) FROM session_entries WHERE exercise_id = $1)::int AS se,
                (SELECT COUNT(*) FROM personal_bests WHERE exercise_id = $1)::int AS pb`,
        [id]
      );
      await client.query('DELETE FROM exercises WHERE id = $1', [id]);
      log.push(`delete   ${id} "${name}"  (removed from programs: ${te.rowCount} rows; unlinked: ${c.se} logged sets, ${c.pb} PRs)`);
    }

    // ── Muscle group / video / hide ──
    for (const [id, g] of Object.entries(muscle)) {
      await client.query('UPDATE exercises SET muscle_group = $1 WHERE id = $2', [g, Number(id)]);
      log.push(`muscle   ${id} "${ex.get(Number(id)).name}": ${ex.get(Number(id)).muscle_group} → ${g}`);
    }
    for (const [from, to] of Object.entries(plan.muscleRename || {})) {
      const r = await client.query('UPDATE exercises SET muscle_group = $1 WHERE muscle_group = $2', [to, from]);
      log.push(`group    "${from}" → "${to}"  (${r.rowCount} exercises)`);
    }
    for (const [id, v] of Object.entries(video)) {
      await client.query("UPDATE exercises SET video_id = $1, video_linked_by = 'admin' WHERE id = $2", [v, Number(id)]);
      log.push(`video    ${id} "${ex.get(Number(id)).name}": ${ex.get(Number(id)).video_id || '(none)'} → ${v}`);
    }
    for (const id of hide) {
      await client.query('UPDATE exercises SET hidden_from_library = TRUE WHERE id = $1', [id]);
      log.push(`hide     ${id} "${ex.get(id).name}"`);
    }

    // ── Post-checks ──
    const after = await backfillCandidates(client);
    const reintroduced = after.filter((n) => !before.map((b) => b.toLowerCase()).includes(n.toLowerCase()));
    const { rows: dupes } = await client.query(
      'SELECT LOWER(name) AS n, COUNT(*)::int AS c FROM exercises WHERE created_by IS NULL GROUP BY 1 HAVING COUNT(*) > 1'
    );
    const { rows: [counts] } = await client.query(
      `SELECT (SELECT COUNT(*) FROM exercises)::int AS all_ex,
              (SELECT COUNT(*) FROM exercises WHERE created_by IS NULL)::int AS master,
              (SELECT COUNT(*) FROM exercises WHERE hidden_from_library)::int AS hidden`
    );
    const { rows: emptyTemplates } = await client.query(
      `SELECT t.id, t.name, p.name AS program FROM templates t LEFT JOIN programs p ON p.id = t.program_id
       WHERE COALESCE(t.is_rest, FALSE) = FALSE
         AND NOT EXISTS (SELECT 1 FROM template_exercises te WHERE te.template_id = t.id)
         AND t.id IN (SELECT DISTINCT template_id FROM template_exercises)`
    );

    console.log('\n' + log.join('\n'));
    console.log(`\nLibrary after: ${counts.all_ex} exercises (${counts.master} master, ${counts.hidden} hidden from library)`);
    console.log(`Names the boot backfill would newly re-create: ${reintroduced.length ? reintroduced.join(', ') : 'none'}`);
    console.log(`Duplicate master names: ${dupes.length ? JSON.stringify(dupes) : 'none'}`);
    console.log(`Workout days left with no exercises: ${emptyTemplates.length ? JSON.stringify(emptyTemplates) : 'none'}`);
    if (reintroduced.length || dupes.length) throw new Error('Post-check failed — rolling back');

    if (APPLY) {
      await client.query('COMMIT');
      console.log('\nCOMMITTED.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDRY RUN — rolled back, nothing changed. Re-run with --apply to commit.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

// Move PR rows from exercise `from` to exercise `to` under name `toName`.
// Rows are per (user, template, exercise_name, weight) = most reps at that
// weight; on collision keep the higher reps (and its achieved_at).
async function mergePRs(client, from, to, toName) {
  const { rows } = await client.query('SELECT * FROM personal_bests WHERE exercise_id = $1', [from]);
  for (const r of rows) {
    const { rows: [clash] } = await client.query(
      `SELECT * FROM personal_bests
       WHERE user_id = $1 AND template_id IS NOT DISTINCT FROM $2 AND exercise_name = $3
         AND best_weight = $4 AND id <> $5`,
      [r.user_id, r.template_id, toName, r.best_weight, r.id]
    );
    if (clash) {
      if (r.best_reps > clash.best_reps) {
        await client.query('UPDATE personal_bests SET best_reps = $1, achieved_at = $2, exercise_id = $3 WHERE id = $4',
          [r.best_reps, r.achieved_at, to, clash.id]);
      }
      await client.query('DELETE FROM personal_bests WHERE id = $1', [r.id]);
    } else {
      await client.query('UPDATE personal_bests SET exercise_id = $1, exercise_name = $2 WHERE id = $3', [to, toName, r.id]);
    }
  }
  return rows.length;
}

main();
