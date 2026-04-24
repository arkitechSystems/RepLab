// Reports any exercise referenced by a LIBRARY program (user_id IS NULL)
// whose name does not appear in the master `exercises` table. Run after
// adding or editing a library program so you can decide whether to add
// the missing names to the master library.
//
// Wired into .claude/settings.json as a PostToolUse hook — fires whenever
// Claude executes a file under server/migrations/.
//
// Run manually: node --env-file=server/.env server/check-exercise-coverage.js

import pool from './dbPool.js';

async function run() {
  const { rows } = await pool.query(`
    SELECT DISTINCT te.name AS exercise, p.name AS program, t.name AS template
    FROM template_exercises te
    JOIN templates t ON t.id = te.template_id
    JOIN programs p  ON p.id = t.program_id
    LEFT JOIN exercises e ON LOWER(e.name) = LOWER(te.name)
    WHERE p.user_id IS NULL
      AND COALESCE(te.is_section_header, FALSE) = FALSE
      AND e.id IS NULL
    ORDER BY p.name, te.name, t.name
  `);

  if (rows.length === 0) {
    console.log('[exercise-coverage] OK — every library exercise is in the master library.');
    return;
  }

  console.log(`[exercise-coverage] ${rows.length} library exercise(s) MISSING from the master exercise library:`);
  let currentProgram = null;
  for (const r of rows) {
    if (r.program !== currentProgram) {
      console.log(`\n  ${r.program}:`);
      currentProgram = r.program;
    }
    console.log(`    - "${r.exercise}"  (in "${r.template}")`);
  }
  console.log('\n  Add these to the master exercises table so future programs can reference them.');
}

try {
  await run();
} catch (err) {
  console.error('[exercise-coverage] check failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
