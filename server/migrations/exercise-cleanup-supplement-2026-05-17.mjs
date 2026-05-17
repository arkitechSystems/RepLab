// Supplemental cleanup for the 4 same-name collisions Path A skipped.
//
// Original sheet rows (all source.name == target.name, different ids):
//   id 117 (Dumbbell Shoulder Press)    -> 252
//   id 290 (Banded DB Shoulder Press)   -> 269
//   id 321 (Single Leg Hack Squat)      -> 280
//   id 283 (Cable Flyes (Middle Chest)) -> 312
//
// For each pair, the source and target share a name in `exercises`. The
// generic Path A validator skipped them because it couldn't safely rename
// the string columns when two exercises share a name. But these are
// `sameName` cases — no string rename needed. We:
//   1. Merge personal_bests per-user (heaviest wins, tiebreak reps).
//   2. Delete the source row from exercises.
//   3. Re-backfill exercise_id columns since the FK link is ambiguous
//      whenever two exercises shared a name (the backfill chose
//      arbitrarily and may have pointed some rows at the soon-to-be-deleted
//      id). Re-running the LOWER(name) backfill is idempotent and
//      converges once the duplicate is gone.

import pool from '../dbPool.js';

const PAIRS = [
  { sourceId: 117, targetId: 252, name: 'Dumbbell Shoulder Press' },
  { sourceId: 290, targetId: 269, name: 'Banded DB Shoulder Press' },
  { sourceId: 321, targetId: 280, name: 'Single Leg Hack Squat' },
  { sourceId: 283, targetId: 312, name: 'Cable Flyes (Middle Chest)' },
];

const COMMIT = process.argv.includes('--commit');

async function run() {
  const client = await pool.connect();
  console.log(`[supplement] ${COMMIT ? 'COMMIT' : 'DRY-RUN'} mode`);
  try {
    await client.query('BEGIN');

    for (const p of PAIRS) {
      console.log(`\n[supplement] ${p.name}: delete id ${p.sourceId}, keep id ${p.targetId}`);

      // Sanity: both ids exist and share a name.
      const check = await client.query(
        'SELECT id, name FROM exercises WHERE id = ANY($1::int[])',
        [[p.sourceId, p.targetId]]
      );
      if (check.rows.length !== 2) {
        console.log(`[supplement]   skipping — one or both ids missing (rows=${check.rows.length})`);
        continue;
      }

      // Merge PRs per user (same logic as Path A, idempotent if no dupes).
      const merge = await client.query(
        `
        WITH ranked AS (
          SELECT id, user_id,
            ROW_NUMBER() OVER (
              PARTITION BY user_id
              ORDER BY best_weight DESC NULLS LAST, best_reps DESC NULLS LAST, id ASC
            ) AS rn
          FROM personal_bests
          WHERE LOWER(exercise_name) = LOWER($1)
        ),
        losers AS (
          DELETE FROM personal_bests pb
          USING ranked r
          WHERE pb.id = r.id AND r.rn > 1
          RETURNING pb.id
        )
        SELECT (SELECT COUNT(*)::int FROM losers) AS pbs_deleted
        `,
        [p.name]
      );
      console.log(`[supplement]   PR rows deleted in merge: ${merge.rows[0].pbs_deleted}`);

      // Delete the source from exercises.
      const del = await client.query('DELETE FROM exercises WHERE id = $1', [p.sourceId]);
      console.log(`[supplement]   exercises rows deleted: ${del.rowCount}`);
    }

    // Re-backfill the three exercise_id columns now that name collisions are
    // resolved. Idempotent — only touches rows currently NULL OR pointing at
    // a now-deleted id (latter shouldn't happen due to ON DELETE SET NULL,
    // but rerunning by-name match is safe).
    console.log('\n[supplement] re-backfilling exercise_id columns post-delete...');
    const teRe = await client.query(`
      UPDATE template_exercises te
      SET exercise_id = e.id
      FROM exercises e
      WHERE (te.exercise_id IS NULL OR NOT EXISTS (SELECT 1 FROM exercises x WHERE x.id = te.exercise_id))
        AND COALESCE(te.is_section_header, FALSE) = FALSE
        AND LOWER(te.name) = LOWER(e.name)
    `);
    console.log(`[supplement]   template_exercises re-linked: ${teRe.rowCount}`);

    const seRe = await client.query(`
      UPDATE session_entries se
      SET exercise_id = e.id
      FROM exercises e
      WHERE (se.exercise_id IS NULL OR NOT EXISTS (SELECT 1 FROM exercises x WHERE x.id = se.exercise_id))
        AND LOWER(se.exercise_name) = LOWER(e.name)
    `);
    console.log(`[supplement]   session_entries re-linked: ${seRe.rowCount}`);

    const pbRe = await client.query(`
      UPDATE personal_bests pb
      SET exercise_id = e.id
      FROM exercises e
      WHERE (pb.exercise_id IS NULL OR NOT EXISTS (SELECT 1 FROM exercises x WHERE x.id = pb.exercise_id))
        AND LOWER(pb.exercise_name) = LOWER(e.name)
    `);
    console.log(`[supplement]   personal_bests re-linked: ${pbRe.rowCount}`);

    if (COMMIT) {
      await client.query('COMMIT');
      console.log('\n[supplement] COMMITTED');
    } else {
      await client.query('ROLLBACK');
      console.log('\n[supplement] DRY-RUN — rolled back');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[supplement] FAILED — rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

await run();
await pool.end();
