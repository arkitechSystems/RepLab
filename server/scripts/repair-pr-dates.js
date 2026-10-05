// One-time repair: PR dates (personal_bests.achieved_at) were rewritten to
// the save time on every in-session save, so months-old PRs looked brand
// new. This resets each PR's date to the day it was first lifted: the
// earliest session in the same workout with a checked set at that exact
// weight × reps. Rows already on the right day are left alone.
//
// Dry run (default):  node --env-file=.env scripts/repair-pr-dates.js
// Apply:              node --env-file=.env scripts/repair-pr-dates.js --apply
import pool from '../dbPool.js';

const apply = process.argv.includes('--apply');

const { rows } = await pool.query(`
  SELECT pb.id, pb.exercise_name, pb.best_weight, pb.best_reps,
         pb.achieved_at, first_hit.date AS first_date
    FROM personal_bests pb
    JOIN LATERAL (
      SELECT MIN(s.date) AS date
        FROM session_entries se
        JOIN sessions s ON s.id = se.session_id
       WHERE s.user_id = pb.user_id
         AND s.template_id = pb.template_id
         AND se.exercise_name = pb.exercise_name
         AND se.weight = pb.best_weight
         AND se.reps = pb.best_reps
         AND se.is_completed = TRUE
    ) first_hit ON first_hit.date IS NOT NULL
   WHERE TO_CHAR(pb.achieved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') <> first_hit.date
`);

console.log(`${rows.length} PR rows have the wrong date.`);
for (const r of rows.slice(0, 15)) {
  console.log(`  #${r.id} ${r.exercise_name} ${r.best_weight} x ${r.best_reps}: ${new Date(r.achieved_at).toISOString().slice(0, 10)} -> ${r.first_date}`);
}
if (rows.length > 15) console.log(`  ...and ${rows.length - 15} more`);

if (!apply) {
  console.log('\nDry run — nothing changed. Re-run with --apply to fix.');
} else if (rows.length > 0) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        'UPDATE personal_bests SET achieved_at = $1 WHERE id = $2',
        [new Date(`${r.first_date}T12:00:00Z`), r.id]
      );
    }
    await client.query('COMMIT');
    console.log(`\nFixed ${rows.length} PR dates.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
await pool.end();
