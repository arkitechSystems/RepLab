// One-off: delete the junk master-library exercise literally named "B"
// (id=626), which got a bogus YouTube video auto-linked to it
// ("Reyno_Return Demo B (Form 1)" — clearly not a real exercise demo,
// just a mismatch from the auto-link-videos.js nightly job). Confirmed
// unused by any template_exercises row before running. Idempotent.

import pool from '../dbPool.js';

const EXERCISE_ID = 626;
const EXPECTED_NAME = 'B';

async function main() {
  console.log('────────────────────────────────────────────');
  console.log(` REPLAB master library — remove junk exercise id=${EXERCISE_ID}`);
  console.log('────────────────────────────────────────────\n');

  const found = await pool.query(
    `SELECT id, name, video_id FROM exercises WHERE id = $1`,
    [EXERCISE_ID]
  );
  if (!found.rowCount) {
    console.log(`Already gone — no exercise with id=${EXERCISE_ID}. Nothing to do.`);
    return;
  }
  const row = found.rows[0];
  if (row.name !== EXPECTED_NAME) {
    console.error(`❌ Refusing to delete: id=${EXERCISE_ID} has name "${row.name}", expected "${EXPECTED_NAME}". Aborting.`);
    return;
  }
  console.log(`Found id=${row.id} name="${row.name}" video_id=${row.video_id}`);

  const inUse = await pool.query(
    `SELECT id FROM template_exercises WHERE exercise_id = $1`,
    [EXERCISE_ID]
  );
  if (inUse.rowCount) {
    console.error(`❌ Refusing to delete: ${inUse.rowCount} template_exercises row(s) still reference this id. Aborting.`);
    return;
  }

  await pool.query(`DELETE FROM exercises WHERE id = $1`, [EXERCISE_ID]);
  console.log(`\n✓ Deleted exercise id=${EXERCISE_ID} ("${row.name}").`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
