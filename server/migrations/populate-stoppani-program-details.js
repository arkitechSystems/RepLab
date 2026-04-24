// Sets program_details JSON on the Stoppani program so the collapsible
// Program Details accordion renders on its Browse Library page — matching
// the one already shown on Muscle & Fitness 5000.
//
// Run with: node --env-file=server/.env server/migrations/populate-stoppani-program-details.js
// Idempotent.

import pool from '../dbPool.js';

const PROGRAM_NAME = "Jim Stoppani's Shortcut to Shred";

const DETAILS = {
  Program: '6 Week Shortcut to Shred',
  Source: 'Bodybuilding.com',
  'Main Goal': 'Fat Loss / Body Recomposition',
  'Training Level': 'Intermediate',
  'Program Duration': '6 Weeks',
  'Days Per Week': '6 Days',
  'Time Per Workout': '45-60 Mins',
  Equipment: 'Barbell, Dumbbells, Cables, Bodyweight, Smith Machine, Machines',
  Author: 'Jim Stoppani',
  'Workout Link': 'https://www.bodybuilding.com/shortcut2shred',
  Overview:
    'Cardio acceleration is central to Shortcut to Shred. The method combines resistance training and high-intensity cardio into one fast-paced workout. Instead of resting between lifting sets, perform a cardio acceleration movement for roughly one minute between sets. Phase 1 (weeks 1-3) uses straight sets; Phase 2 (weeks 4-6) adds cardio-accelerated rest-pause dropsets on the last set of each exercise.',
};

async function run() {
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      `UPDATE programs SET program_details = $1
       WHERE user_id IS NULL AND name = $2`,
      [JSON.stringify(DETAILS), PROGRAM_NAME]
    );
    if (rowCount === 0) {
      console.error(`Program "${PROGRAM_NAME}" not found.`);
      process.exit(1);
    }
    console.log(`Program details set on "${PROGRAM_NAME}".`);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
