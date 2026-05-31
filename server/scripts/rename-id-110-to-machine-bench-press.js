// One-off: rename exercise id=110 from "Machine Chest Press" to
// "Machine Bench Press". Handles two cases transactionally:
//   (a) target name doesn't exist yet → simple rename + cascade-rename
//       legacy name refs in template_exercises.name and
//       personal_bests.exercise_name so by-name lookups still resolve.
//   (b) target name already exists    → full merge into the existing
//       canonical: remap template_exercises.exercise_id,
//       session_entries.exercise_id, and personal_bests.exercise_id
//       (plus the text name fields) to the target row, then DELETE
//       the source row.

import pool from '../dbPool.js';

const SOURCE_ID = 110;
const EXPECTED_FROM_NAME = 'Machine Chest Press';
const TO_NAME = 'Machine Bench Press';

async function main() {
  console.log('────────────────────────────────────────────');
  console.log(` REPLAB master library — rename id=${SOURCE_ID} → "${TO_NAME}"`);
  console.log('────────────────────────────────────────────\n');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const srcRes = await client.query(
      `SELECT id, name, muscle_group FROM exercises WHERE id = $1`,
      [SOURCE_ID]
    );
    if (!srcRes.rowCount) {
      console.error(`❌ Source exercise id=${SOURCE_ID} not found.`);
      await client.query('ROLLBACK');
      return;
    }
    const src = srcRes.rows[0];
    console.log(`Source row: id=${src.id} "${src.name}" muscle_group="${src.muscle_group}"`);
    if (src.name.toLowerCase() !== EXPECTED_FROM_NAME.toLowerCase()) {
      console.warn(`⚠ Expected current name "${EXPECTED_FROM_NAME}", found "${src.name}". Proceeding anyway.`);
    }

    const targetRes = await client.query(
      `SELECT id, name, muscle_group FROM exercises
       WHERE LOWER(name) = LOWER($1) AND created_by IS NULL AND id <> $2
       LIMIT 1`,
      [TO_NAME, SOURCE_ID]
    );

    if (!targetRes.rowCount) {
      // Case (a): simple rename.
      console.log(`Target "${TO_NAME}" does not exist — simple rename.`);
      const upd = await client.query(
        `UPDATE exercises SET name = $1 WHERE id = $2`,
        [TO_NAME, SOURCE_ID]
      );
      console.log(`  ✓ exercises rows updated: ${upd.rowCount}`);

      const teRes = await client.query(
        `UPDATE template_exercises SET name = $1 WHERE LOWER(name) = LOWER($2)`,
        [TO_NAME, src.name]
      );
      console.log(`  ✓ template_exercises rows renamed (by name): ${teRes.rowCount}`);

      const pbRes = await client.query(
        `UPDATE personal_bests SET exercise_name = $1 WHERE LOWER(exercise_name) = LOWER($2)`,
        [TO_NAME, src.name]
      );
      console.log(`  ✓ personal_bests rows renamed: ${pbRes.rowCount}`);
    } else {
      // Case (b): full merge.
      const target = targetRes.rows[0];
      console.log(`Target row already exists: id=${target.id} "${target.name}" — MERGE into it.`);

      const teRes = await client.query(
        `UPDATE template_exercises
         SET exercise_id = $1, name = $2
         WHERE exercise_id = $3 OR LOWER(name) = LOWER($4)`,
        [target.id, TO_NAME, src.id, src.name]
      );
      console.log(`  ✓ template_exercises rows remapped: ${teRes.rowCount}`);

      const seRes = await client.query(
        `UPDATE session_entries SET exercise_id = $1 WHERE exercise_id = $2`,
        [target.id, src.id]
      );
      console.log(`  ✓ session_entries  rows remapped: ${seRes.rowCount}`);

      const pbRes = await client.query(
        `UPDATE personal_bests
         SET exercise_id = $1, exercise_name = $2
         WHERE exercise_id = $3 OR LOWER(exercise_name) = LOWER($4)`,
        [target.id, TO_NAME, src.id, src.name]
      );
      console.log(`  ✓ personal_bests   rows remapped: ${pbRes.rowCount}`);

      const delRes = await client.query(
        `DELETE FROM exercises WHERE id = $1 AND created_by IS NULL`,
        [src.id]
      );
      console.log(`  ✓ duplicate exercise row deleted: ${delRes.rowCount}`);
    }

    await client.query('COMMIT');
    console.log('\n✓ Transaction committed.');
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
