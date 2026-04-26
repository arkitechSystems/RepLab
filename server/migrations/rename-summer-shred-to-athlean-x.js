// Renames the library program "Summer Shred" → "Athlean-X Summer Shred".
// Display abbreviation stays "Summer Shred" (just the full_name key changes).
//
// Run with:
//   node --env-file=server/.env server/migrations/rename-summer-shred-to-athlean-x.js
//
// Idempotent: re-running after the rename has already happened is a no-op
// because the WHERE clauses target the old name and the abbreviations row
// is upserted via ON CONFLICT.

import pool from '../dbPool.js';

const OLD_NAME = 'Summer Shred';
const NEW_NAME = 'Athlean-X Summer Shred';
const SHORT_NAME = 'Summer Shred';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Rename the program (library copy = user_id IS NULL).
    const programResult = await client.query(
      `UPDATE programs SET name = $1
        WHERE name = $2 AND user_id IS NULL
        RETURNING id`,
      [NEW_NAME, OLD_NAME]
    );
    if (programResult.rowCount > 0) {
      console.log(`Renamed program id=${programResult.rows[0].id} → "${NEW_NAME}"`);
    } else {
      console.log(`No "${OLD_NAME}" library program found — skipping rename.`);
    }

    // 2. Drop the old abbreviation row (the full_name was the old program name)
    //    and upsert the new row keyed on the new full_name.
    await client.query(
      `DELETE FROM program_name_abbreviations WHERE full_name = $1`,
      [OLD_NAME]
    );
    await client.query(
      `INSERT INTO program_name_abbreviations (full_name, short_name)
       VALUES ($1, $2)
       ON CONFLICT (full_name) DO UPDATE SET short_name = EXCLUDED.short_name`,
      [NEW_NAME, SHORT_NAME]
    );
    console.log(`Abbreviation: "${NEW_NAME}" → "${SHORT_NAME}"`);

    await client.query('COMMIT');
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
