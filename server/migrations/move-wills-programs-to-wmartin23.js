// Migration: move "Will's PPL" and "Will's Upper/Lower/PPL" out of the
// public workout library and into wmartin23's personal workouts.
//
// Library programs have programs.user_id IS NULL. Personal programs are owned
// by a specific user. Same applies to templates.user_id (templates belonging
// to a library program have user_id NULL; personal templates are owned).
//
// This migration:
//   1. Finds the user_id for username 'wmartin23'.
//   2. Updates `programs.user_id` for both target programs.
//   3. Updates `templates.user_id` for every template whose program_id
//      matches either program (so the templates also disappear from other
//      users' /templates GET, which returns user_id IS NULL OR user_id = $1).
//
// Run with:
//   node --env-file=server/.env server/migrations/move-wills-programs-to-wmartin23.js

import pool from '../dbPool.js';

// Note: account username is 'Wmartin' (matched case-insensitively) — kept the
// '...wmartin23' filename for the GitHub naming you requested in chat.
const TARGET_USERNAME = 'Wmartin';
const PROGRAM_NAMES = ["Will's PPL", "Will's Upper/Lower/PPL"];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Resolve user
    const { rows: userRows } = await client.query(
      `SELECT id, username, email FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [TARGET_USERNAME]
    );
    if (userRows.length === 0) {
      throw new Error(`User '${TARGET_USERNAME}' not found.`);
    }
    const userId = userRows[0].id;
    console.log(`Target user: ${userRows[0].username} (id=${userId}, email=${userRows[0].email})`);

    // 2. Find the library copies of the target programs
    const { rows: progRows } = await client.query(
      `SELECT id, name, user_id FROM programs
        WHERE name = ANY($1::text[]) AND user_id IS NULL`,
      [PROGRAM_NAMES]
    );
    if (progRows.length === 0) {
      console.log('No library copies found — nothing to move.');
      await client.query('COMMIT');
      return;
    }
    console.log(`\nLibrary programs to move (${progRows.length}):`);
    for (const p of progRows) console.log(`  [${p.id}] ${p.name}`);

    const programIds = progRows.map((r) => r.id);

    // 3. Show templates that will move
    const { rows: tmplRows } = await client.query(
      `SELECT id, name, program_id, user_id FROM templates WHERE program_id = ANY($1::int[])`,
      [programIds]
    );
    console.log(`\nTemplates to move (${tmplRows.length}):`);
    for (const t of tmplRows) console.log(`  [${t.id}] ${t.name} (program=${t.program_id}, current user_id=${t.user_id})`);

    // 4. Update programs.user_id
    const { rowCount: progUpdated } = await client.query(
      `UPDATE programs SET user_id = $1 WHERE id = ANY($2::int[])`,
      [userId, programIds]
    );

    // 5. Update templates.user_id for templates belonging to those programs
    const { rowCount: tmplUpdated } = await client.query(
      `UPDATE templates SET user_id = $1 WHERE program_id = ANY($2::int[])`,
      [userId, programIds]
    );

    await client.query('COMMIT');
    console.log(`\nDone. Updated ${progUpdated} program(s) and ${tmplUpdated} template(s) to user_id=${userId}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed — rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
