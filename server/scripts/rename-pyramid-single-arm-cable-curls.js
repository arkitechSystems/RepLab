// One-off rename: "Pyramid Single-Arm Cable Curls" → "Single-Arm Cable Curls".
// "Pyramid" is a set scheme, not part of the canonical exercise name — the
// underlying movement is just a Single-Arm Cable Curl and should sit under
// that canonical name in the library.
//
// Two cases handled inside one transaction:
//   (a) target name doesn't exist yet → simple rename
//   (b) target name already exists    → full merge (remap template_exercises,
//       session_entries, personal_bests FKs and exercise_name text refs to
//       the canonical row, then DELETE the duplicate)
//
// Default is --dry-run (no writes — BEGIN/ROLLBACK). Pass --apply to commit.
//
// Run:
//   cd server
//   node --env-file=.env scripts/rename-pyramid-single-arm-cable-curls.js          (dry-run)
//   node --env-file=.env scripts/rename-pyramid-single-arm-cable-curls.js --apply  (commit)

import pool from '../dbPool.js';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

const FROM_NAME = 'Pyramid Single-Arm Cable Curls';
const TO_NAME = 'Single-Arm Cable Curls';

async function main() {
  console.log('───────────────────────────────────────────────────────');
  console.log(' REPLAB master library — rename Pyramid Single-Arm Cable Curls');
  console.log('───────────────────────────────────────────────────────');
  console.log(`Mode: ${APPLY ? 'APPLY (commit)' : 'DRY-RUN (rollback)'}`);
  console.log(`From: "${FROM_NAME}"`);
  console.log(`To:   "${TO_NAME}"\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const fromRes = await client.query(
      `SELECT id, name, muscle_group FROM exercises
       WHERE LOWER(name) = LOWER($1) AND created_by IS NULL
       LIMIT 1`,
      [FROM_NAME]
    );
    if (!fromRes.rowCount) {
      console.log(`Source "${FROM_NAME}" not found in master library. Nothing to do.`);
      await client.query('ROLLBACK');
      return;
    }
    const source = fromRes.rows[0];
    console.log(`Source row: id=${source.id} "${source.name}" muscle_group="${source.muscle_group}"`);

    const toRes = await client.query(
      `SELECT id, name, muscle_group FROM exercises
       WHERE LOWER(name) = LOWER($1) AND created_by IS NULL
       LIMIT 1`,
      [TO_NAME]
    );

    if (!toRes.rowCount) {
      // Case (a): target doesn't exist — simple rename.
      console.log(`Target "${TO_NAME}" does not exist yet — simple rename.`);
      const upd = await client.query(
        `UPDATE exercises SET name = $1 WHERE id = $2 AND created_by IS NULL`,
        [TO_NAME, source.id]
      );
      console.log(`  ✓ exercises rows updated: ${upd.rowCount}`);

      // Update legacy name references so PR history etc. follows the rename.
      const teRes = await client.query(
        `UPDATE template_exercises SET name = $1 WHERE LOWER(name) = LOWER($2)`,
        [TO_NAME, FROM_NAME]
      );
      console.log(`  ✓ template_exercises rows renamed (by name): ${teRes.rowCount}`);

      const pbRes = await client.query(
        `UPDATE personal_bests SET exercise_name = $1 WHERE LOWER(exercise_name) = LOWER($2)`,
        [TO_NAME, FROM_NAME]
      );
      console.log(`  ✓ personal_bests rows renamed: ${pbRes.rowCount}`);
    } else {
      // Case (b): target already exists — full merge into the existing canonical.
      const target = toRes.rows[0];
      console.log(`Target row: id=${target.id} "${target.name}" muscle_group="${target.muscle_group}" — MERGE into this row.`);

      const teRes = await client.query(
        `UPDATE template_exercises
         SET exercise_id = $1, name = $2
         WHERE exercise_id = $3 OR LOWER(name) = LOWER($4)`,
        [target.id, TO_NAME, source.id, FROM_NAME]
      );
      console.log(`  ✓ template_exercises rows remapped: ${teRes.rowCount}`);

      const seRes = await client.query(
        `UPDATE session_entries SET exercise_id = $1 WHERE exercise_id = $2`,
        [target.id, source.id]
      );
      console.log(`  ✓ session_entries  rows remapped: ${seRes.rowCount}`);

      const pbRes = await client.query(
        `UPDATE personal_bests
         SET exercise_id = $1, exercise_name = $2
         WHERE exercise_id = $3 OR LOWER(exercise_name) = LOWER($4)`,
        [target.id, TO_NAME, source.id, FROM_NAME]
      );
      console.log(`  ✓ personal_bests   rows remapped: ${pbRes.rowCount}`);

      const delRes = await client.query(
        `DELETE FROM exercises WHERE id = $1 AND created_by IS NULL`,
        [source.id]
      );
      console.log(`  ✓ duplicate exercise row deleted: ${delRes.rowCount}`);
    }

    if (APPLY) {
      await client.query('COMMIT');
      console.log('\n✓ Transaction committed.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDRY-RUN: transaction rolled back. Pass --apply to commit.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Migration failed — transaction rolled back. Error:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
