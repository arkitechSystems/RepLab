// Migration: Add "Muscle & Fitness 5000 rep arm specialization" program card
// to the RepLab library. Original migration left workouts empty; the
// follow-up populate-muscle-strength-5000-arms.js seeds all 10 weeks of
// templates. Description has been updated to reflect the populated state.
//
// Run with: node --env-file=server/.env server/migrations/add-muscle-fitness-5000-arms.js
// Re-running is safe — the script is idempotent (name + user_id IS NULL is the
// uniqueness check).

import pool from '../dbPool.js';

const PROGRAM_NAME = 'Muscle & Fitness 5000 Rep Arm Specialization';
const DESCRIPTION  = 'High-volume arm specialization block. 10 weeks, alternating 3-day and 2-day training splits — ~5,000 dedicated arm reps across the program.';
const SORT_ORDER   = 17;
const PROGRAM_TYPE = 'hypertrophy';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM programs WHERE user_id IS NULL AND name = $1',
      [PROGRAM_NAME]
    );

    if (existing.length) {
      console.log(`Program already exists (id=${existing[0].id}) — nothing to do.`);
      await client.query('COMMIT');
      return;
    }

    const { rows: [p] } = await client.query(
      `INSERT INTO programs (user_id, name, description, sort_order, program_type)
       VALUES (NULL, $1, $2, $3, $4) RETURNING id`,
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
