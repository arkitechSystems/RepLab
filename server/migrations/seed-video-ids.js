import pool from '../dbPool.js';

const VIDEO_MAP = {
  'Barbell Bench Press': 'tuwHzzPdaGc',
  'Incline Dumbbell Press': '8nNi8jbbUPE',
  'Seated Shoulder Press (DB)': 'FRxZ6wr5bpA',
  'Cable Tricep Pushdown': 'LzwgB15UdO8',
  'Overhead Tricep Extension (rope)': 'NRENeEgaIgA',
  'Lat Pulldown': 'iKrKgWR9wbY',
  'Barbell Row': 'paCfxhgW6bI',
  'Face Pulls': '7ZvpXA_mFpQ',
  'Back Squat': 'R2dMsNhN3DE',
  'Romanian Deadlift': 'CkrqLaDGvOA',
  'Leg Press': 'sEM_zo9w2ss',
  'Leg Extension': '0fl1RRgJ83I',
  'Standing Calf Raise': 'RBslMmWqzzE',
};

async function seedVideoIds() {
  // Ensure column exists
  await pool.query('ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_id TEXT');

  let updated = 0;
  for (const [name, videoId] of Object.entries(VIDEO_MAP)) {
    const result = await pool.query(
      'UPDATE exercises SET video_id = $1 WHERE LOWER(name) = LOWER($2)',
      [videoId, name]
    );
    if (result.rowCount > 0) {
      console.log(`  Updated "${name}" -> ${videoId} (${result.rowCount} row(s))`);
      updated += result.rowCount;
    } else {
      console.log(`  No match for "${name}"`);
    }
  }

  console.log(`\nDone. Updated ${updated} exercise(s) with video IDs.`);
  await pool.end();
}

seedVideoIds().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
