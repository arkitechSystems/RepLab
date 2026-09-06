// One-off: point "Dumbbell Lateral Raise" at the RepLab CDN-hosted demo
// video instead of a YouTube ID, to test native <video src> streaming from
// replab-videos.onrender.com end to end (ExerciseCard.jsx already renders
// any video_id starting with "http" via <video src> instead of the YouTube
// iframe — see exerciseVideos.js / ExerciseCard.jsx). Idempotent.

import pool from '../dbPool.js';

const EXERCISE_NAME = 'Dumbbell Lateral Raise';
const CDN_VIDEO_URL = 'https://replab-videos.onrender.com/wills-hypertrophy-program/DB%20Bent%20Arm%20Lateral%20Raises.mp4';

async function main() {
  console.log('────────────────────────────────────────────');
  console.log(` REPLAB master library — link CDN video to "${EXERCISE_NAME}"`);
  console.log('────────────────────────────────────────────\n');

  const found = await pool.query(
    `SELECT id, name, video_id, video_linked_by FROM exercises
     WHERE LOWER(name) = LOWER($1) AND created_by IS NULL`,
    [EXERCISE_NAME]
  );
  if (!found.rowCount) {
    console.error(`❌ "${EXERCISE_NAME}" not found in the master library. Aborting.`);
    return;
  }
  const row = found.rows[0];
  console.log(`Found id=${row.id} "${row.name}" — current video_id: ${row.video_id || '(none)'} (linked_by: ${row.video_linked_by || 'n/a'})`);

  const upd = await pool.query(
    `UPDATE exercises SET video_id = $1, video_linked_by = 'claude_code' WHERE id = $2
     RETURNING id, name, video_id, video_linked_by`,
    [CDN_VIDEO_URL, row.id]
  );
  const updated = upd.rows[0];
  console.log(`\n✓ Updated id=${updated.id} "${updated.name}"`);
  console.log(`  video_id: ${updated.video_id}`);
  console.log(`  video_linked_by: ${updated.video_linked_by}`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
