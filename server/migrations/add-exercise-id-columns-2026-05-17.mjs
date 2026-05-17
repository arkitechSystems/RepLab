// Path B step 1: add exercise_id FK columns to the three string-keyed tables
// that currently identify exercises by name, and backfill them via
// case-insensitive name lookup into the master `exercises` table.
//
// Tables:
//   template_exercises.exercise_id  INT REFERENCES exercises(id) ON DELETE SET NULL
//   session_entries.exercise_id     INT REFERENCES exercises(id) ON DELETE SET NULL
//   personal_bests.exercise_id      INT REFERENCES exercises(id) ON DELETE SET NULL
//
// All three columns stay NULLABLE for now. The existing read paths still key
// on the string column. The follow-up refactor (server queries → client UI)
// switches reads/writes onto exercise_id; once that's in and stable, a later
// migration can add NOT NULL.
//
// Section headers in template_exercises (is_section_header = TRUE) get
// exercise_id = NULL — they don't reference an exercise. Their `name` is
// the section label.
//
// Idempotent: ADD COLUMN IF NOT EXISTS, and the backfill only touches rows
// where exercise_id IS NULL.
//
// Run:
//   node --env-file=server/.env server/migrations/add-exercise-id-columns-2026-05-17.mjs

import pool from '../dbPool.js';

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ---- 1. Add the columns + FKs ----
    console.log('[add-exercise-id] adding columns...');
    await client.query(`
      ALTER TABLE template_exercises
        ADD COLUMN IF NOT EXISTS exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL;
    `);
    await client.query(`
      ALTER TABLE session_entries
        ADD COLUMN IF NOT EXISTS exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL;
    `);
    await client.query(`
      ALTER TABLE personal_bests
        ADD COLUMN IF NOT EXISTS exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL;
    `);

    // Indexes for the eventual id-keyed reads. Cheap to create now; the
    // refactor will lean on them heavily.
    await client.query('CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise_id ON template_exercises(exercise_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_session_entries_exercise_id ON session_entries(exercise_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_personal_bests_exercise_id ON personal_bests(exercise_id)');

    // ---- 2. Backfill via LOWER(name) match ----
    // Section-header rows in template_exercises must stay NULL.
    console.log('[add-exercise-id] backfilling template_exercises...');
    const teRes = await client.query(`
      UPDATE template_exercises te
      SET exercise_id = e.id
      FROM exercises e
      WHERE te.exercise_id IS NULL
        AND COALESCE(te.is_section_header, FALSE) = FALSE
        AND LOWER(te.name) = LOWER(e.name)
    `);
    console.log(`[add-exercise-id]   template_exercises backfilled: ${teRes.rowCount}`);

    console.log('[add-exercise-id] backfilling session_entries...');
    const seRes = await client.query(`
      UPDATE session_entries se
      SET exercise_id = e.id
      FROM exercises e
      WHERE se.exercise_id IS NULL
        AND LOWER(se.exercise_name) = LOWER(e.name)
    `);
    console.log(`[add-exercise-id]   session_entries backfilled: ${seRes.rowCount}`);

    console.log('[add-exercise-id] backfilling personal_bests...');
    const pbRes = await client.query(`
      UPDATE personal_bests pb
      SET exercise_id = e.id
      FROM exercises e
      WHERE pb.exercise_id IS NULL
        AND LOWER(pb.exercise_name) = LOWER(e.name)
    `);
    console.log(`[add-exercise-id]   personal_bests backfilled: ${pbRes.rowCount}`);

    // ---- 3. Report any rows that couldn't be linked ----
    const teGap = await client.query(`
      SELECT COUNT(*)::int AS n FROM template_exercises
      WHERE exercise_id IS NULL AND COALESCE(is_section_header, FALSE) = FALSE
    `);
    const seGap = await client.query(`
      SELECT COUNT(*)::int AS n FROM session_entries WHERE exercise_id IS NULL
    `);
    const pbGap = await client.query(`
      SELECT COUNT(*)::int AS n FROM personal_bests WHERE exercise_id IS NULL
    `);
    console.log('[add-exercise-id] unresolved (couldn\'t link via name):');
    console.log(`[add-exercise-id]   template_exercises (non-section): ${teGap.rows[0].n}`);
    console.log(`[add-exercise-id]   session_entries: ${seGap.rows[0].n}`);
    console.log(`[add-exercise-id]   personal_bests: ${pbGap.rows[0].n}`);

    // If there ARE gaps, show the names so the user can decide what to do.
    if (teGap.rows[0].n > 0) {
      const sample = await client.query(`
        SELECT DISTINCT name FROM template_exercises
        WHERE exercise_id IS NULL AND COALESCE(is_section_header, FALSE) = FALSE
        ORDER BY name LIMIT 30
      `);
      console.log('[add-exercise-id]   sample te names:', sample.rows.map((r) => r.name).join(', '));
    }
    if (seGap.rows[0].n > 0) {
      const sample = await client.query(`
        SELECT DISTINCT exercise_name FROM session_entries WHERE exercise_id IS NULL
        ORDER BY exercise_name LIMIT 30
      `);
      console.log('[add-exercise-id]   sample se names:', sample.rows.map((r) => r.exercise_name).join(', '));
    }
    if (pbGap.rows[0].n > 0) {
      const sample = await client.query(`
        SELECT DISTINCT exercise_name FROM personal_bests WHERE exercise_id IS NULL
        ORDER BY exercise_name LIMIT 30
      `);
      console.log('[add-exercise-id]   sample pb names:', sample.rows.map((r) => r.exercise_name).join(', '));
    }

    await client.query('COMMIT');
    console.log('[add-exercise-id] COMMITTED');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[add-exercise-id] FAILED — rolled back:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

await run();
await pool.end();
