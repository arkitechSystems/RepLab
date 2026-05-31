// Diagnostic — find every row anywhere that mentions "Nordic Curl" so we can
// see why a "Nordic Curls" row is still surfacing in the UI even though the
// master library only has "Nordic Hamstring Curl" (id 616). Read-only.
//
// Run with:
//   node --env-file=.env server/scripts/find-nordic-curls.js

import pool from '../dbPool.js';

async function main() {
  console.log('\n=== exercises (master + customs) matching "nordic" ===');
  const ex = await pool.query(
    `SELECT id, name, muscle_group, is_custom, created_by
       FROM exercises
      WHERE LOWER(name) LIKE '%nordic%'
      ORDER BY created_by NULLS FIRST, id`
  );
  for (const r of ex.rows) {
    console.log(`  [${r.id}] "${r.name}"  muscle=${r.muscle_group}  is_custom=${r.is_custom}  created_by=${r.created_by ?? 'NULL'}`);
  }
  console.log(`  (${ex.rows.length} row(s))`);

  console.log('\n=== template_exercises with name matching "nordic" ===');
  const te = await pool.query(
    `SELECT id, template_id, exercise_id, name
       FROM template_exercises
      WHERE LOWER(name) LIKE '%nordic%'
      ORDER BY template_id, id`
  );
  for (const r of te.rows) {
    console.log(`  [${r.id}] template=${r.template_id} exercise_id=${r.exercise_id ?? 'NULL'} name="${r.name}"`);
  }
  console.log(`  (${te.rows.length} row(s))`);

  console.log('\n=== session_entries with name matching "nordic" ===');
  const se = await pool.query(
    `SELECT id, session_id, exercise_id, exercise_name
       FROM session_entries
      WHERE LOWER(exercise_name) LIKE '%nordic%'
      ORDER BY session_id, id`
  );
  for (const r of se.rows) {
    console.log(`  [${r.id}] session=${r.session_id} exercise_id=${r.exercise_id ?? 'NULL'} name="${r.exercise_name}"`);
  }
  console.log(`  (${se.rows.length} row(s))`);

  console.log('\n=== personal_bests with name matching "nordic" ===');
  const pb = await pool.query(
    `SELECT id, user_id, template_id, exercise_id, exercise_name, best_weight, best_reps
       FROM personal_bests
      WHERE LOWER(exercise_name) LIKE '%nordic%'
      ORDER BY user_id, id`
  );
  for (const r of pb.rows) {
    console.log(`  [${r.id}] user=${r.user_id} template=${r.template_id} exercise_id=${r.exercise_id ?? 'NULL'} name="${r.exercise_name}" weight=${r.best_weight} reps=${r.best_reps}`);
  }
  console.log(`  (${pb.rows.length} row(s))`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Query failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
