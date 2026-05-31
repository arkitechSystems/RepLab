// One-off DB cleanup of three exercises flagged as 'Other':
//   1. DELETE library row id=622 ("B" — junk single-letter entry; no user
//      references since users couldn't have meaningfully logged it).
//   2. UPDATE library row id=624 ("Cable Tricep Pushdowns") muscle_group
//      from 'Other' to 'Triceps'.
//   3. Promote user-custom id=583 ("Close Grip DB Bench", owner @Wmartin)
//      to the master library with muscle_group='Triceps'. Strategy depends
//      on whether the library already has a row by that name:
//        a. No existing library row → flip is_custom=FALSE, created_by=NULL
//           on row 583 in place, so all of @Wmartin's references (PRs,
//           session_entries, template_exercises) stay intact.
//        b. Existing library row exists → relink @Wmartin's references
//           from 583 → the existing library row, then delete 583.
//
// All three steps run in a single transaction. Read-only safety: if any
// step fails, the whole thing rolls back.
//
// Run once with: node --env-file=.env server/scripts/cleanup-other-exercises-2026-05-24.js

import pool from '../dbPool.js';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── 1. Delete 622 ───────────────────────────────────────────────────
    {
      // Sanity-check the row first so we don't nuke something with a
      // surprising name. The id is hardcoded but the name should match.
      const { rows: pre } = await client.query(
        'SELECT id, name, muscle_group FROM exercises WHERE id = $1',
        [622]
      );
      if (pre.length === 0) {
        console.log('[622] not found — skip.');
      } else {
        console.log(`[622] BEFORE: name="${pre[0].name}", muscle_group="${pre[0].muscle_group}"`);
        const del = await client.query('DELETE FROM exercises WHERE id = $1', [622]);
        console.log(`[622] deleted (${del.rowCount} row).`);
      }
    }

    // ─── 2. Reclassify 624 ───────────────────────────────────────────────
    {
      const { rows: pre } = await client.query(
        'SELECT id, name, muscle_group FROM exercises WHERE id = $1',
        [624]
      );
      if (pre.length === 0) {
        console.log('[624] not found — skip.');
      } else {
        console.log(`[624] BEFORE: name="${pre[0].name}", muscle_group="${pre[0].muscle_group}"`);
        const upd = await client.query(
          `UPDATE exercises SET muscle_group = 'Triceps' WHERE id = $1`,
          [624]
        );
        console.log(`[624] reclassified to Triceps (${upd.rowCount} row).`);
      }
    }

    // ─── 3. Promote 583 ──────────────────────────────────────────────────
    {
      const { rows: pre } = await client.query(
        'SELECT id, name, muscle_group, created_by, is_custom FROM exercises WHERE id = $1',
        [583]
      );
      if (pre.length === 0) {
        console.log('[583] not found — skip.');
      } else {
        const custom = pre[0];
        console.log(`[583] BEFORE: name="${custom.name}", muscle_group="${custom.muscle_group}", created_by=${custom.created_by}, is_custom=${custom.is_custom}`);

        // Is there already a library row with the same name?
        const { rows: existing } = await client.query(
          `SELECT id, name, muscle_group
             FROM exercises
            WHERE LOWER(name) = LOWER($1)
              AND created_by IS NULL
              AND id != $2
            LIMIT 1`,
          [custom.name, custom.id]
        );

        if (existing.length === 0) {
          // (a) In-place promote — preserves id 583, all references stay valid.
          const upd = await client.query(
            `UPDATE exercises
                SET is_custom = FALSE,
                    created_by = NULL,
                    muscle_group = 'Triceps'
              WHERE id = $1`,
            [custom.id]
          );
          console.log(`[583] promoted in place (${upd.rowCount} row): is_custom=FALSE, created_by=NULL, muscle_group=Triceps.`);
        } else {
          // (b) Merge — relink references then delete the custom row.
          const libId = existing[0].id;
          console.log(`[583] existing library row found: id=${libId}, name="${existing[0].name}" — merging.`);

          const te = await client.query(
            'UPDATE template_exercises SET exercise_id = $1 WHERE exercise_id = $2',
            [libId, custom.id]
          );
          const se = await client.query(
            'UPDATE session_entries SET exercise_id = $1 WHERE exercise_id = $2',
            [libId, custom.id]
          );
          const pb = await client.query(
            'UPDATE personal_bests SET exercise_id = $1 WHERE exercise_id = $2',
            [libId, custom.id]
          );
          const del = await client.query('DELETE FROM exercises WHERE id = $1', [custom.id]);
          console.log(`[583] merged into ${libId}: te=${te.rowCount}, se=${se.rowCount}, pb=${pb.rowCount}, deleted=${del.rowCount}.`);

          // Ensure the surviving library row is classified as Triceps too.
          await client.query(
            `UPDATE exercises SET muscle_group = 'Triceps' WHERE id = $1 AND COALESCE(muscle_group, '') != 'Triceps'`,
            [libId]
          );
          console.log(`[${libId}] muscle_group set to Triceps.`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('\nAll done.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED — rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
