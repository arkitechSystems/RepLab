// One-off DB cleanup to fold "Nordic Curls" into "Nordic Hamstring Curl".
//
// Current state (discovered via find-nordic-curls.js on 2026-05-26):
//   - id 616 "Nordic Hamstring Curl"  → master, muscle=Hamstrings (canonical)
//   - id 307 "Nordic Curls"            → user-custom owned by user 37
//
// History: the 2026-05-17 library cleanup made id 307 the master canonical
// row. Sometime later, id 616 was added as the new master and id 307 was
// demoted to a custom, leaving an orphaned-custom situation where many
// users' template_exercises / session_entries / personal_bests still point
// to id 307 across different users (including users 20, 37, etc.).
//
// Strategy (idempotent, transactional):
//   1. Find every exercises row (master OR custom) whose name matches
//      "Nordic Curls" (case-insensitive). Each one is a "duplicate row" to
//      be merged into id 616 ("Nordic Hamstring Curl").
//   2. Find the canonical "Nordic Hamstring Curl" master row. If it doesn't
//      exist, rename the duplicate in place (case B). Otherwise relink and
//      delete (case A).
//   3. For each duplicate row, relink all template_exercises.exercise_id,
//      session_entries.exercise_id, personal_bests.exercise_id to the
//      canonical id, and rewrite the denormalized .name / .exercise_name
//      columns to the canonical name.
//   4. Dedupe personal_bests: if relinking would create two PBs for the
//      same (user_id, template_id, exercise_id), keep the higher one
//      (higher best_weight wins; tiebreak on best_reps), drop the rest.
//      Matches the app's PB comparison rule (see CLAUDE.md memory).
//   5. Sweep legacy rows where exercise_id was never backfilled by matching
//      LOWER(name) = 'nordic curls' / LOWER(exercise_name) = 'nordic curls'.
//   6. Delete the duplicate exercises rows.
//
// Run once with:
//   node --env-file=.env server/scripts/cleanup-nordic-curls-2026-05-26.js

import pool from '../dbPool.js';

const CANONICAL = 'Nordic Hamstring Curl';
const DUPLICATE = 'Nordic Curls';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── Find duplicate rows (master + customs) ──────────────────────────
    const { rows: duplicates } = await client.query(
      `SELECT id, name, muscle_group, is_custom, created_by
         FROM exercises
        WHERE LOWER(name) = LOWER($1)`,
      [DUPLICATE]
    );
    const { rows: canonRows } = await client.query(
      `SELECT id, name, muscle_group
         FROM exercises
        WHERE LOWER(name) = LOWER($1)
          AND created_by IS NULL
        LIMIT 1`,
      [CANONICAL]
    );

    if (duplicates.length === 0) {
      // Only legacy name-only rows might exist. Sweep them and we're done.
      console.log(`No exercises rows match "${DUPLICATE}". Sweeping any legacy un-backfilled rows…`);
      await sweepLegacyNameRows(client);
      await client.query('COMMIT');
      console.log('Done — nothing else to clean up.');
      return;
    }

    console.log(`Found ${duplicates.length} "${DUPLICATE}" row(s):`);
    for (const d of duplicates) {
      console.log(`  [${d.id}] name="${d.name}" muscle=${d.muscle_group} is_custom=${d.is_custom} created_by=${d.created_by ?? 'NULL'}`);
    }

    let canonId;
    if (canonRows.length > 0) {
      canonId = canonRows[0].id;
      console.log(`\nCanonical master exists: [${canonId}] "${canonRows[0].name}" muscle=${canonRows[0].muscle_group}`);
    } else {
      // No canonical exists yet. Promote the first master duplicate to be it.
      const promote = duplicates.find((d) => d.created_by === null) ?? duplicates[0];
      console.log(`\nNo canonical "${CANONICAL}" master row exists. Promoting [${promote.id}] in place.`);
      await client.query(
        `UPDATE exercises
            SET name = $1,
                is_custom = FALSE,
                created_by = NULL
          WHERE id = $2`,
        [CANONICAL, promote.id]
      );
      canonId = promote.id;
      // Drop it from the duplicates list since it's now the canonical itself.
      duplicates.splice(duplicates.indexOf(promote), 1);
    }

    // ─── For each remaining duplicate row, merge into canonId ────────────
    for (const d of duplicates) {
      if (d.id === canonId) continue;
      console.log(`\nMerging [${d.id}] → [${canonId}]…`);

      // template_exercises — no unique constraint, straight relink.
      const te = await client.query(
        `UPDATE template_exercises
            SET exercise_id = $1, name = $2
          WHERE exercise_id = $3`,
        [canonId, CANONICAL, d.id]
      );

      // session_entries — no unique constraint, straight relink.
      const se = await client.query(
        `UPDATE session_entries
            SET exercise_id = $1, exercise_name = $2
          WHERE exercise_id = $3`,
        [canonId, CANONICAL, d.id]
      );

      // personal_bests — dedupe by (user_id, template_id) within the
      // canonical exercise. For each src PB, if a dst PB already exists
      // for that (user, template, canonId), keep the higher (weight, reps);
      // otherwise relink in place.
      const { rows: srcPbs } = await client.query(
        `SELECT id, user_id, template_id, best_weight, best_reps, exercise_name
           FROM personal_bests
          WHERE exercise_id = $1`,
        [d.id]
      );
      let pbRelinked = 0;
      let pbDeleted = 0;
      let pbReplaced = 0;
      for (const src of srcPbs) {
        const { rows: dstRows } = await client.query(
          `SELECT id, best_weight, best_reps
             FROM personal_bests
            WHERE user_id = $1
              AND template_id IS NOT DISTINCT FROM $2
              AND exercise_id = $3
            LIMIT 1`,
          [src.user_id, src.template_id, canonId]
        );
        if (dstRows.length === 0) {
          await client.query(
            `UPDATE personal_bests
                SET exercise_id = $1, exercise_name = $2
              WHERE id = $3`,
            [canonId, CANONICAL, src.id]
          );
          pbRelinked++;
        } else {
          const dst = dstRows[0];
          const srcW = Number(src.best_weight) || 0;
          const dstW = Number(dst.best_weight) || 0;
          const srcR = Number(src.best_reps) || 0;
          const dstR = Number(dst.best_reps) || 0;
          const srcWins = srcW > dstW || (srcW === dstW && srcR > dstR);
          if (srcWins) {
            // Replace the dst PB with src's values, then drop src.
            await client.query(
              `UPDATE personal_bests
                  SET best_weight = $1, best_reps = $2, exercise_name = $3, achieved_at = NOW()
                WHERE id = $4`,
              [src.best_weight, src.best_reps, CANONICAL, dst.id]
            );
            await client.query('DELETE FROM personal_bests WHERE id = $1', [src.id]);
            pbReplaced++;
          } else {
            // dst already wins; just drop src.
            await client.query('DELETE FROM personal_bests WHERE id = $1', [src.id]);
            pbDeleted++;
          }
        }
      }

      console.log(`  te=${te.rowCount}, se=${se.rowCount}, pb_relinked=${pbRelinked}, pb_replaced=${pbReplaced}, pb_deleted=${pbDeleted}`);

      // Now delete the duplicate exercises row itself. The FK on
      // template_exercises / session_entries / personal_bests is ON DELETE
      // SET NULL, so any rows we missed would just lose their exercise_id —
      // but we just relinked everything we can find by exercise_id, so this
      // should drop cleanly.
      const del = await client.query('DELETE FROM exercises WHERE id = $1', [d.id]);
      console.log(`  exercises deleted: ${del.rowCount}`);
    }

    // ─── Sweep legacy un-backfilled rows by name ─────────────────────────
    await sweepLegacyNameRows(client);

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

// Catch rows where exercise_id was never backfilled but the name still says
// "Nordic Curls". The dual-write transition (see schema.sql comment on
// template_exercises.exercise_id) leaves some old rows joined by name only.
async function sweepLegacyNameRows(client) {
  const teName = await client.query(
    `UPDATE template_exercises
        SET name = $1
      WHERE exercise_id IS NULL
        AND LOWER(name) = LOWER($2)`,
    [CANONICAL, DUPLICATE]
  );
  const seName = await client.query(
    `UPDATE session_entries
        SET exercise_name = $1
      WHERE exercise_id IS NULL
        AND LOWER(exercise_name) = LOWER($2)`,
    [CANONICAL, DUPLICATE]
  );
  const pbName = await client.query(
    `UPDATE personal_bests
        SET exercise_name = $1
      WHERE exercise_id IS NULL
        AND LOWER(exercise_name) = LOWER($2)`,
    [CANONICAL, DUPLICATE]
  );
  if (teName.rowCount || seName.rowCount || pbName.rowCount) {
    console.log(`Legacy name sweep: te=${teName.rowCount}, se=${seName.rowCount}, pb=${pbName.rowCount}`);
  }
}

main();
