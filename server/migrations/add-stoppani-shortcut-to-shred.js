// Migration: Add Jim Stoppani's Shortcut to Shred — 6-week cut/conditioning
// block — to the RepLab library under the new Strength & Conditioning category.
// Workouts left empty for now; they'll be filled in by a follow-up migration.
//
// Run with: node --env-file=server/.env server/migrations/add-stoppani-shortcut-to-shred.js
// Re-running is safe — idempotent on (user_id IS NULL, name).

import pool from '../dbPool.js';

const PROGRAM_NAME = "Jim Stoppani's Shortcut to Shred";
const DESCRIPTION  = '6-week fat-loss program pairing cardio acceleration with heavy compound work.';
const SORT_ORDER   = 18;
const PROGRAM_TYPE = 'strength_conditioning';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );

    if (existing.length) {
      // Ensure cardio acceleration flag is on even on re-run against a
      // previously-created row (handles upgrade path).
      await client.query(
        'UPDATE programs SET cardio_acceleration_enabled = TRUE WHERE id = $1',
        [existing[0].id]
      );
      console.log(`Program already exists (id=${existing[0].id}); ensured cardio_acceleration_enabled=TRUE.`);
      await client.query('COMMIT');
      return;
    }

    const { rows: [p] } = await client.query(
      `INSERT INTO programs (user_id, name, description, sort_order, program_type, cardio_acceleration_enabled)
       VALUES (NULL, $1, $2, $3, $4, TRUE) RETURNING id`,
      [PROGRAM_NAME, DESCRIPTION, SORT_ORDER, PROGRAM_TYPE]
    );

    await client.query('COMMIT');
    console.log(`Created program "${PROGRAM_NAME}" (id=${p.id}, sort=${SORT_ORDER}, type=${PROGRAM_TYPE}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
