// Migration: Assign program_type to existing library programs
// Run with: node --env-file=server/.env server/migrations/assign-program-types.js

import pool from '../dbPool.js';

const TYPE_MAP = {
  'Smolov Squat & Bench Program': 'strength',
  'Mike Mentzer Workout': 'strength',
  "Will's Hypertrophy Program": 'hypertrophy',
  'Glute Hypertrophy': 'hypertrophy',
  'Bro Split Workout': 'hypertrophy',
  "ZJ's Workout": 'hypertrophy',
  'Push, Pull, Legs': 'hybrid',
  "Will's PPL": 'hybrid',
  "Will's Upper/Lower/PPL": 'hybrid',
  'Summer Shred': 'conditioning',
};

async function run() {
  try {
    // Ensure column exists
    await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'other'`);

    const { rows } = await pool.query('SELECT id, name, program_type FROM programs WHERE user_id IS NULL');
    console.log(`Found ${rows.length} library programs:`);
    for (const p of rows) {
      console.log(`  [${p.id}] ${p.name} (current: ${p.program_type || 'null'})`);
    }

    let updated = 0;
    for (const p of rows) {
      const newType = TYPE_MAP[p.name];
      if (newType && newType !== p.program_type) {
        await pool.query('UPDATE programs SET program_type = $1 WHERE id = $2', [newType, p.id]);
        console.log(`  Updated "${p.name}" -> ${newType}`);
        updated++;
      }
    }

    console.log(`\nDone. Updated ${updated} program(s).`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
