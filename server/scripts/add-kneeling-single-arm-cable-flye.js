// One-off: add "Kneeling Single Arm Cable Flye" to the master library
// under the Chest muscle group. Idempotent — if the row already exists,
// reports the existing id and exits without writing.

import pool from '../dbPool.js';

const NAME = 'Kneeling Single Arm Cable Flye';
const MUSCLE_GROUP = 'Chest';

async function main() {
  console.log('────────────────────────────────────────────');
  console.log(' REPLAB master library — add Kneeling Single Arm Cable Flye');
  console.log('────────────────────────────────────────────\n');

  const existing = await pool.query(
    `SELECT id, name, muscle_group FROM exercises
     WHERE LOWER(name) = LOWER($1) AND created_by IS NULL`,
    [NAME]
  );

  if (existing.rowCount) {
    const row = existing.rows[0];
    console.log(`Row already exists. No insert performed.`);
    console.log(`  id=${row.id}  name="${row.name}"  muscle_group="${row.muscle_group}"`);
    await pool.end();
    return;
  }

  const ins = await pool.query(
    `INSERT INTO exercises (name, muscle_group, tags, is_custom, created_by)
     VALUES ($1, $2, $3, FALSE, NULL)
     RETURNING id, name, muscle_group`,
    [NAME, MUSCLE_GROUP, ['cable']]
  );
  const row = ins.rows[0];
  console.log(`✓ Inserted master-library exercise:`);
  console.log(`  id=${row.id}  name="${row.name}"  muscle_group="${row.muscle_group}"  tags=['cable']`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
