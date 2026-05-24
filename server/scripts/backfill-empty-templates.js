// One-off backfill: every user-owned template that has zero rows in
// template_exercises gets populated from its most recent session's
// workout_data, using the same syncEmptyTemplateFromWorkoutData helper
// that runs during live session saves. Idempotent — re-runs on an already
// populated template are no-ops (the helper's empty-check fails).
//
// Run with:
//   node --env-file=.env server/scripts/backfill-empty-templates.js          (dry-run, default)
//   node --env-file=.env server/scripts/backfill-empty-templates.js --apply  (actually write)
//
// Requires DATABASE_URL in env (same as the server). Prints a per-template
// status line + a summary at the end.

import pool from '../dbPool.js';
import { syncEmptyTemplateFromWorkoutData } from '../db.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes will be committed)' : 'DRY-RUN (no writes)'}`);
  console.log('Finding empty user-owned templates...');

  // Empty user-owned templates that have at least one session attached
  // (no point seeding a template that the user never actually ran).
  // Using NOT EXISTS instead of LEFT JOIN so we don't blow up if a
  // template has hundreds of template_exercises rows.
  const { rows: targets } = await pool.query(
    `SELECT t.id AS template_id,
            t.user_id,
            t.name AS template_name,
            (
              SELECT s.workout_data
                FROM sessions s
               WHERE s.template_id = t.id
                 AND s.user_id     = t.user_id
                 AND s.workout_data IS NOT NULL
            ORDER BY s.created_at DESC
               LIMIT 1
            ) AS workout_data
       FROM templates t
      WHERE t.user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM template_exercises te WHERE te.template_id = t.id
        )
      ORDER BY t.id ASC`
  );

  console.log(`Found ${targets.length} empty user-owned template(s).`);

  const stats = { seeded: 0, skipped: 0, errored: 0 };
  for (const row of targets) {
    const { template_id: templateId, user_id: userId, template_name: name, workout_data: workoutData } = row;
    if (!workoutData || !Array.isArray(workoutData.exercises) || workoutData.exercises.length === 0) {
      console.log(`  [${templateId}] "${name}" (user ${userId}) — skip: no session with exercises`);
      stats.skipped++;
      continue;
    }

    if (!APPLY) {
      const exCount = workoutData.exercises.filter((e) => e && !e.isSectionHeader && e.name).length;
      console.log(`  [${templateId}] "${name}" (user ${userId}) — would seed ${exCount} exercise(s)`);
      stats.seeded++;
      continue;
    }

    // One transaction per template so a failure on one doesn't taint the rest.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await syncEmptyTemplateFromWorkoutData(client, userId, templateId, workoutData);
      await client.query('COMMIT');
      // Confirm by re-counting after commit so the log reflects reality.
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*)::int AS n FROM template_exercises WHERE template_id = $1',
        [templateId]
      );
      console.log(`  [${templateId}] "${name}" (user ${userId}) — seeded, now has ${countRows[0].n} row(s)`);
      stats.seeded++;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (_) {}
      console.error(`  [${templateId}] "${name}" (user ${userId}) — ERROR: ${err.message}`);
      stats.errored++;
    } finally {
      client.release();
    }
  }

  console.log('');
  console.log('---------------------------------');
  console.log(`Seeded:  ${stats.seeded}${APPLY ? '' : ' (would seed)'}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errored: ${stats.errored}`);
  console.log('---------------------------------');
  if (!APPLY && stats.seeded > 0) {
    console.log('Run with --apply to commit these changes.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
