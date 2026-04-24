// Reassigns library program categories per 2026-04-23 decision:
//   - Summer Shred                    → strength_conditioning
//   - Will's PPL                      → hypertrophy
//   - Will's Upper/Lower/PPL          → hypertrophy_strength  (new category)
//
// Run with: node --env-file=server/.env server/migrations/reassign-program-types-2026-04-23.js
// Idempotent: matched by exact name + user_id IS NULL.

import pool from '../dbPool.js';

const CHANGES = [
  ['Summer Shred', 'strength_conditioning'],
  ["Will's PPL", 'hypertrophy'],
  ["Will's Upper/Lower/PPL", 'hypertrophy_strength'],
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [name, newType] of CHANGES) {
      const { rowCount } = await client.query(
        `UPDATE programs SET program_type = $1
         WHERE user_id IS NULL AND name = $2`,
        [newType, name]
      );
      if (rowCount === 0) console.warn(`  [skip] "${name}" not found`);
      else console.log(`  "${name}" → ${newType}`);
    }
    await client.query('COMMIT');
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
