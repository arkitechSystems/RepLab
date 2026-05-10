// Seed (or refresh) the Apple App Store reviewer demo account.
// Idempotent: safe to re-run — re-uses existing user/program/sessions
// rather than erroring on duplicates.
//
// Creates `apple-reviewer@replab-fitness.com` (Free tier, role=user) with:
//   - realistic profile + user_metrics
//   - the "Will's Hypertrophy Program" library program assigned to their
//     schedule for the upcoming 7 days (falls back to any seeded library
//     program if Will's Hypertrophy is missing)
//   - 3-5 logged sessions on dates in the past week
//
// Run: REVIEWER_PASSWORD='...' node --env-file=server/.env server/scripts/seed-apple-reviewer.js
//
// REVIEWER_PASSWORD must be set in the environment. The password is the
// reviewer login credential — never hardcode it in source. Rotate the
// password before each App Store submission and paste the new value into
// App Store Connect's "App Review Information" demo-account field.
import pkg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

const REVIEWER_EMAIL = 'apple-reviewer@replab-fitness.com';
const REVIEWER_PASSWORD = process.env.REVIEWER_PASSWORD;
const REVIEWER_FIRST = 'Apple';
const REVIEWER_LAST = 'Reviewer';

if (!REVIEWER_PASSWORD || REVIEWER_PASSWORD.length < 8) {
  console.error('REVIEWER_PASSWORD env var is required (min 8 chars). Aborting.');
  process.exit(1);
}

// Format a Date as YYYY-MM-DD in UTC.
function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function ensureUser(client) {
  const { rows: existing } = await client.query(
    'SELECT id FROM users WHERE email = $1',
    [REVIEWER_EMAIL]
  );
  const passwordHash = await bcrypt.hash(REVIEWER_PASSWORD, 10);

  if (existing.length > 0) {
    const id = existing[0].id;
    // Refresh password + profile fields on every run so a forgotten
    // password / role drift / accidental admin promotion can't break review.
    await client.query(
      `UPDATE users
          SET password_hash = $1,
              first_name    = $2,
              last_name     = $3,
              role          = 'user',
              plan          = 'Free',
              trial_end     = NULL
        WHERE id = $4`,
      [passwordHash, REVIEWER_FIRST, REVIEWER_LAST, id]
    );
    return { id, created: false };
  }

  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, plan)
     VALUES ($1, $2, $3, $4, 'user', 'Free') RETURNING id`,
    [REVIEWER_EMAIL, passwordHash, REVIEWER_FIRST, REVIEWER_LAST]
  );
  return { id: rows[0].id, created: true };
}

async function pickLibraryProgram(client) {
  // Prefer Will's Hypertrophy (the marketing-hook program), fall back to any
  // seeded library program (user_id IS NULL). Skip programs with no
  // non-rest templates — those would log nothing useful for the reviewer.
  const target = "Will's Hypertrophy Program";
  const { rows: hits } = await client.query(
    `SELECT p.id, p.name
       FROM programs p
      WHERE p.user_id IS NULL AND p.name = $1
      LIMIT 1`,
    [target]
  );
  if (hits.length > 0) return hits[0];

  const { rows: fallback } = await client.query(
    `SELECT p.id, p.name
       FROM programs p
      WHERE p.user_id IS NULL
        AND EXISTS (
          SELECT 1 FROM templates t
           WHERE t.program_id = p.id AND COALESCE(t.is_rest, false) = false
        )
      ORDER BY p.sort_order, p.id
      LIMIT 1`
  );
  return fallback[0] || null;
}

async function getProgramTemplates(client, programId) {
  const { rows } = await client.query(
    `SELECT id, name, COALESCE(is_rest, false) AS is_rest, sort_order
       FROM templates
      WHERE program_id = $1
      ORDER BY sort_order, id`,
    [programId]
  );
  return rows;
}

async function seedSchedule(client, userId, templates) {
  // Map the next 7 days starting today onto the program's templates so
  // when the reviewer opens the Calendar / Today view they see workouts
  // queued up. Also wipes any stale schedule_days for this user first
  // (idempotent — second run gives a fresh week).
  await client.query('DELETE FROM schedule_days WHERE user_id = $1', [userId]);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + i);
    const tpl = templates[i % templates.length];
    if (!tpl) continue;
    await client.query(
      `INSERT INTO schedule_days (user_id, schedule_date, template_id, is_rest)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, schedule_date)
       DO UPDATE SET template_id = $3, is_rest = $4`,
      [userId, ymd(d), tpl.id, tpl.is_rest]
    );
  }
}

async function seedSessions(client, userId, templates) {
  // Pick up to 4 non-rest templates and log a session for each on a
  // past date (yesterday, 2 days ago, ...). Done as direct INSERTs so
  // we can specify the historical date string; db.createSession uses
  // NOW() for activity timestamps but the `date` column is a TEXT
  // YYYY-MM-DD which we control. Idempotent via a delete-then-insert
  // for any existing (user_id, template_id, date) row.
  const workouts = templates.filter((t) => !t.is_rest).slice(0, 4);
  if (workouts.length === 0) return 0;

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  // Realistic dummy sets for whichever exercises the template defines.
  // We read the actual template_exercises rows so logged entries line
  // up with what the reviewer will see in the workout detail view.
  let logged = 0;
  for (let i = 0; i < workouts.length; i++) {
    const tpl = workouts[i];
    const sessionDate = new Date(today);
    sessionDate.setUTCDate(today.getUTCDate() - (i + 1));
    const dateStr = ymd(sessionDate);

    const { rows: exRows } = await client.query(
      `SELECT name, set_number, planned_reps, suggested_weight,
              COALESCE(is_section_header, false) AS is_section_header
         FROM template_exercises
        WHERE template_id = $1
        ORDER BY sort_order, set_number`,
      [tpl.id]
    );
    const realSets = exRows.filter((r) => !r.is_section_header);
    if (realSets.length === 0) continue;

    // Idempotent: drop any prior session for this user+template+date so
    // we don't accumulate duplicate session_entries on re-run.
    await client.query(
      `DELETE FROM sessions
        WHERE user_id = $1 AND template_id = $2 AND date = $3`,
      [userId, tpl.id, dateStr]
    );

    const { rows: sessionRows } = await client.query(
      `INSERT INTO sessions (user_id, template_id, date, notes, completed, last_activity_at, created_at)
       VALUES ($1, $2, $3, '{}'::jsonb, true, $4, $4)
       RETURNING id`,
      [userId, tpl.id, dateStr, sessionDate.toISOString()]
    );
    const sessionId = sessionRows[0].id;

    for (const set of realSets) {
      const planned = Number(set.planned_reps) || 10;
      const suggested = Number(set.suggested_weight) || 0;
      // Hit reps as planned, occasionally one short — looks lived-in
      // rather than a perfect-bot record.
      const reps = Math.max(1, planned - (set.set_number > 2 ? 1 : 0));
      const weight = suggested > 0 ? suggested : 100;
      await client.query(
        `INSERT INTO session_entries (session_id, exercise_name, set_number, weight, reps)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, set.name, set.set_number, weight, reps]
      );
    }
    logged++;
  }
  return logged;
}

async function seedMetrics(client, userId) {
  await client.query(
    `INSERT INTO user_metrics (user_id, height, weight, body_fat, max_bench, max_squat, max_deadlift, updated_at)
     VALUES ($1, 70, 175, 15, 225, 315, 405, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       height = 70, weight = 175, body_fat = 15,
       max_bench = 225, max_squat = 315, max_deadlift = 405,
       updated_at = NOW()`,
    [userId]
  );
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id: userId, created } = await ensureUser(client);

    const program = await pickLibraryProgram(client);
    if (!program) {
      throw new Error(
        'No seeded library program found (programs.user_id IS NULL with non-rest templates). Run initDb / seed scripts first.'
      );
    }

    const templates = await getProgramTemplates(client, program.id);
    if (templates.length === 0) {
      throw new Error(`Program "${program.name}" has no templates.`);
    }

    await seedSchedule(client, userId, templates);
    const sessionCount = await seedSessions(client, userId, templates);
    await seedMetrics(client, userId);

    await client.query('COMMIT');

    console.log('---');
    console.log(`Reviewer ${created ? 'created' : 'refreshed'}: user_id=${userId}`);
    console.log(`Reviewer login: ${REVIEWER_EMAIL} / ${REVIEWER_PASSWORD}`);
    console.log(`Assigned program: "${program.name}" (id=${program.id}, ${templates.length} templates)`);
    console.log(`Schedule: 7 upcoming days populated`);
    console.log(`Sessions logged in past week: ${sessionCount}`);
    console.log(`Metrics: 70in / 175lb / 15% BF / bench 225 / squat 315 / dead 405`);
    console.log('---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
