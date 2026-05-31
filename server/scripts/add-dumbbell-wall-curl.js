// One-off: add "Dumbbell Wall Curl" to the master library, cloning every
// non-id, non-name field from exercise id=153 (per user spec — keep
// everything the same except the name; muscle_group is set explicitly
// to "Biceps" per the request). Idempotent.

import pool from '../dbPool.js';

const NEW_NAME = 'Dumbbell Wall Curl';
const TARGET_MUSCLE_GROUP = 'Biceps';
const SOURCE_ID = 153;

async function main() {
  console.log('────────────────────────────────────────────');
  console.log(` REPLAB master library — add "${NEW_NAME}" (clone of id=${SOURCE_ID})`);
  console.log('────────────────────────────────────────────\n');

  // Pull the reference row so we can carry forward its metadata.
  const ref = await pool.query(
    `SELECT id, name, muscle_group, tags, video_id, video_linked_by, is_custom, created_by
     FROM exercises WHERE id = $1`,
    [SOURCE_ID]
  );
  if (!ref.rowCount) {
    console.error(`❌ Source exercise id=${SOURCE_ID} not found. Aborting.`);
    return;
  }
  const src = ref.rows[0];
  console.log(`Source row id=${src.id} "${src.name}" muscle_group="${src.muscle_group}" tags=${JSON.stringify(src.tags)}`);

  // Idempotent: if "Dumbbell Wall Curl" already exists, report and stop.
  const existing = await pool.query(
    `SELECT id, name, muscle_group FROM exercises
     WHERE LOWER(name) = LOWER($1) AND created_by IS NULL`,
    [NEW_NAME]
  );
  if (existing.rowCount) {
    const row = existing.rows[0];
    console.log(`\nRow already exists. No insert performed.`);
    console.log(`  id=${row.id}  name="${row.name}"  muscle_group="${row.muscle_group}"`);
    return;
  }

  const ins = await pool.query(
    `INSERT INTO exercises (name, muscle_group, tags, video_id, video_linked_by, is_custom, created_by)
     VALUES ($1, $2, $3, NULL, NULL, FALSE, NULL)
     RETURNING id, name, muscle_group, tags`,
    [NEW_NAME, TARGET_MUSCLE_GROUP, src.tags || []]
  );
  const row = ins.rows[0];
  console.log(`\n✓ Inserted master-library exercise:`);
  console.log(`  id=${row.id}  name="${row.name}"  muscle_group="${row.muscle_group}"  tags=${JSON.stringify(row.tags)}`);
  console.log(`  (video_id intentionally left NULL — auto-link-videos.js will pick it up on the next nightly run)`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
