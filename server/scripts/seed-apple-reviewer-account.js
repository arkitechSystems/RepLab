// One-off seeder for the Apple App Review demo account.
//
// Creates a pre-populated REPLAB user that App Reviewers can sign into and
// poke around with: 7 days of schedule, 4-5 completed sessions in the past
// week, a couple of personal records, and one custom workout in My Workouts.
//
// Run with:
//   node --env-file=.env server/scripts/seed-apple-reviewer-account.js
//   node --env-file=.env server/scripts/seed-apple-reviewer-account.js --force
//
// The --force flag DELETES the existing reviewer user (cascade-cleaning all
// of their sessions, schedule, PBs, custom workouts) and recreates them from
// scratch. --force only fires when the email on file matches REVIEWER_EMAIL
// exactly — there is no path here that can blow away a non-reviewer account.
//
// All inserts run inside a single transaction so a failure rolls back cleanly.
//
// Hardcoded credentials below — Will edits these directly before running.
// The reviewer password is printed at the end so you can paste it straight
// into App Store Connect's "App Review Information" demo-account field.

import pool from '../dbPool.js';
import bcrypt from 'bcryptjs';

// ---------- HARDCODED CREDENTIALS (edit before running) ----------
const REVIEWER_EMAIL      = 'apple.reviewer@arkitechsystems.com';
const REVIEWER_PASSWORD   = 'ApplePassReview-2026!';
const REVIEWER_FIRST_NAME = 'Apple';
const REVIEWER_LAST_NAME  = 'Reviewer';
const REVIEWER_USERNAME   = 'apple-reviewer';
const REVIEWER_TIMEZONE   = 'America/New_York';
// Match the live signup salt rounds (server/routes/auth.js: bcrypt.hashSync(..., 10)).
const BCRYPT_SALT_ROUNDS  = 10;
// -----------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');

// Format a Date as YYYY-MM-DD (UTC). sessions.date is TEXT in this shape.
function ymd(d) {
  return d.toISOString().slice(0, 10);
}

// Find a library program (user_id IS NULL) by ILIKE-matching one of the
// provided name patterns in order. Returns the first hit, or null.
async function findLibraryProgram(client, patterns) {
  for (const pat of patterns) {
    const { rows } = await client.query(
      `SELECT id, name
         FROM programs
        WHERE user_id IS NULL
          AND name ILIKE $1
          AND COALESCE(is_featured, false) = false
        ORDER BY sort_order, id
        LIMIT 1`,
      [pat]
    );
    if (rows.length > 0) return rows[0];
  }
  return null;
}

async function firstLibraryProgram(client) {
  const { rows } = await client.query(
    `SELECT p.id, p.name
       FROM programs p
      WHERE p.user_id IS NULL
        AND COALESCE(p.is_featured, false) = false
        AND EXISTS (
          SELECT 1 FROM templates t
           WHERE t.program_id = p.id AND COALESCE(t.is_rest, false) = false
        )
      ORDER BY p.sort_order, p.id
      LIMIT 1`
  );
  return rows[0] || null;
}

async function getWorkoutTemplates(client, programId) {
  const { rows } = await client.query(
    `SELECT id, name, COALESCE(is_rest, false) AS is_rest, sort_order
       FROM templates
      WHERE program_id = $1
        AND COALESCE(is_rest, false) = false
      ORDER BY sort_order, id`,
    [programId]
  );
  return rows;
}

async function getTemplateExercises(client, templateId) {
  const { rows } = await client.query(
    `SELECT id, exercise_id, name, set_type, set_number, planned_reps, suggested_weight,
            sort_order, COALESCE(is_section_header, false) AS is_section_header,
            COALESCE(section_notes, '') AS section_notes
       FROM template_exercises
      WHERE template_id = $1
      ORDER BY sort_order, set_number, id`,
    [templateId]
  );
  return rows;
}

// Resolve master-library exercise_id by case-insensitive name. Master rows
// only (created_by IS NULL). Returns Map<lowercase-name, id>.
async function resolveMasterExerciseIds(client, names) {
  if (names.length === 0) return new Map();
  const lower = [...new Set(names.map((n) => String(n).trim().toLowerCase()))];
  const { rows } = await client.query(
    `SELECT id, LOWER(name) AS lname
       FROM exercises
      WHERE created_by IS NULL
        AND LOWER(name) = ANY($1::text[])`,
    [lower]
  );
  const map = new Map();
  for (const r of rows) map.set(r.lname, r.id);
  return map;
}

async function deleteReviewerIfMatches(client) {
  // Defense in depth: only delete a row whose email matches the hardcoded
  // reviewer email exactly. The LOWER() compare matches the lookup we use
  // for existence checks elsewhere.
  const { rows } = await client.query(
    `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)`,
    [REVIEWER_EMAIL]
  );
  if (rows.length === 0) return false;
  const row = rows[0];
  if (String(row.email).toLowerCase() !== REVIEWER_EMAIL.toLowerCase()) {
    throw new Error(
      `Refusing to --force: matched user id=${row.id} has email "${row.email}" which does not equal REVIEWER_EMAIL "${REVIEWER_EMAIL}".`
    );
  }
  // Cascade does NOT cover everything (some columns are RESTRICT/SET NULL).
  // Wipe rows whose parent FK isn't ON DELETE CASCADE before the user delete.
  await client.query('DELETE FROM sessions WHERE user_id = $1', [row.id]);
  await client.query('DELETE FROM schedule_days WHERE user_id = $1', [row.id]);
  await client.query('DELETE FROM personal_bests WHERE user_id = $1', [row.id]);
  // Templates / programs the user owns. templates cascade to template_exercises.
  await client.query('DELETE FROM templates WHERE user_id = $1', [row.id]);
  await client.query('DELETE FROM programs WHERE user_id = $1', [row.id]);
  // user_metrics has no CASCADE in schema.
  await client.query('DELETE FROM user_metrics WHERE user_id = $1', [row.id]);
  // Finally drop the user. Other tables CASCADE off users(id) where defined.
  await client.query('DELETE FROM users WHERE id = $1', [row.id]);
  return true;
}

async function createReviewerUser(client) {
  const passwordHash = await bcrypt.hash(REVIEWER_PASSWORD, BCRYPT_SALT_ROUNDS);
  // Mirror server/db.js createUser column set. token_version, plan, role
  // have schema defaults so we let the DB fill them — but pass plan/role
  // explicitly to lock them down (defaults can drift; this script must not).
  const { rows } = await client.query(
    `INSERT INTO users (
        email, username, password_hash, first_name, last_name,
        role, plan, timezone
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      REVIEWER_EMAIL,
      REVIEWER_USERNAME,
      passwordHash,
      REVIEWER_FIRST_NAME,
      REVIEWER_LAST_NAME,
      'client',
      'Free',
      REVIEWER_TIMEZONE,
    ]
  );
  return rows[0].id;
}

// Build the same workout_data JSONB shape that POST /sessions/initialize
// produces (server/routes/sessions.js): { name, exercises: [{ name, setType,
// sets: [{ setNumber, plannedReps, suggestedWeight }] }] }.
function buildWorkoutData(templateName, exercises) {
  const byName = new Map();
  for (const ex of exercises) {
    if (ex.is_section_header) continue;
    if (!byName.has(ex.name)) {
      byName.set(ex.name, {
        name: ex.name,
        setType: ex.set_type || 'straight',
        sets: [],
      });
    }
    byName.get(ex.name).sets.push({
      setNumber: ex.set_number,
      plannedReps: ex.planned_reps ?? 10,
      suggestedWeight: Number(ex.suggested_weight) || 0,
    });
  }
  return {
    name: templateName,
    exercises: [...byName.values()],
  };
}

// Sanity check that the workout_data shape we're emitting matches whatever
// shape the live app actually writes. Pulls one real session.workout_data
// out of the DB and confirms the top-level keys overlap with ours. Logs
// (doesn't throw) so a fresh DB with no sessions doesn't block seeding.
async function inspectSessionShape(client) {
  const { rows } = await client.query(
    `SELECT workout_data FROM sessions
      WHERE workout_data IS NOT NULL
      ORDER BY id DESC
      LIMIT 1`
  );
  if (rows.length === 0) {
    console.log('[shape-check] No existing sessions in DB — using buildWorkoutData shape from routes/sessions.js as the source of truth.');
    return null;
  }
  const sample = typeof rows[0].workout_data === 'string'
    ? JSON.parse(rows[0].workout_data)
    : rows[0].workout_data;
  const keys = Object.keys(sample || {});
  console.log(`[shape-check] Sample session.workout_data keys: ${keys.join(', ')}`);
  if (Array.isArray(sample?.exercises) && sample.exercises[0]) {
    console.log(`[shape-check] Sample exercise keys: ${Object.keys(sample.exercises[0]).join(', ')}`);
    if (Array.isArray(sample.exercises[0].sets) && sample.exercises[0].sets[0]) {
      console.log(`[shape-check] Sample set keys: ${Object.keys(sample.exercises[0].sets[0]).join(', ')}`);
    }
  }
  return sample;
}

async function inspectPbShape(client) {
  const { rows } = await client.query(
    `SELECT * FROM personal_bests ORDER BY id DESC LIMIT 1`
  );
  if (rows.length === 0) {
    console.log('[shape-check] No existing personal_bests rows — using schema.sql column set.');
    return null;
  }
  console.log(`[shape-check] Sample personal_bests columns: ${Object.keys(rows[0]).join(', ')}`);
  return rows[0];
}

async function seedSchedule(client, userId, programs) {
  // Cadence: Mon/Wed/Fri/Sat = workout, Tue/Thu/Sun = rest.
  // 0 = Sunday in JS getUTCDay.
  // Pull non-rest templates from each program in round-robin order.
  const workoutDows = new Set([1, 3, 5, 6]);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Flatten workout templates from all candidate programs, round-robin
  // alternating programs so the reviewer sees variety across the week.
  const perProgramTemplates = await Promise.all(
    programs.map((p) => getWorkoutTemplates(client, p.id))
  );
  const workoutTemplatePool = [];
  for (let i = 0; ; i++) {
    let added = false;
    for (const tpls of perProgramTemplates) {
      if (i < tpls.length) {
        workoutTemplatePool.push(tpls[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  if (workoutTemplatePool.length === 0) {
    throw new Error('No non-rest workout templates available across selected library programs.');
  }

  let scheduledCount = 0;
  let cursor = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() + i);
    const dow = d.getUTCDay();
    if (workoutDows.has(dow)) {
      const tpl = workoutTemplatePool[cursor % workoutTemplatePool.length];
      cursor += 1;
      await client.query(
        `INSERT INTO schedule_days (user_id, schedule_date, template_id, is_rest)
         VALUES ($1, $2, $3, FALSE)
         ON CONFLICT (user_id, schedule_date)
         DO UPDATE SET template_id = EXCLUDED.template_id, is_rest = FALSE`,
        [userId, ymd(d), tpl.id]
      );
    } else {
      await client.query(
        `INSERT INTO schedule_days (user_id, schedule_date, template_id, is_rest)
         VALUES ($1, $2, NULL, TRUE)
         ON CONFLICT (user_id, schedule_date)
         DO UPDATE SET template_id = NULL, is_rest = TRUE`,
        [userId, ymd(d)]
      );
    }
    scheduledCount += 1;
  }
  return { scheduledCount, workoutTemplatePool };
}

async function seedSessions(client, userId, workoutTemplatePool) {
  // Log 4 completed sessions on the past 4 weekdays (yesterday, -2, -3, -4),
  // picking from the workout template pool round-robin.
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);

  const sessionsLogged = [];
  for (let i = 0; i < 4; i++) {
    const tpl = workoutTemplatePool[i % workoutTemplatePool.length];
    const sessionDate = new Date(today);
    sessionDate.setUTCDate(today.getUTCDate() - (i + 1));
    const dateStr = ymd(sessionDate);

    const exRows = await getTemplateExercises(client, tpl.id);
    const realRows = exRows.filter((r) => !r.is_section_header);
    if (realRows.length === 0) continue;

    const workoutData = buildWorkoutData(tpl.name, exRows);

    // Insert session. completed=true so it shows in History as done.
    const { rows: sessionRows } = await client.query(
      `INSERT INTO sessions (user_id, template_id, date, notes, completed, workout_data, last_activity_at, created_at)
       VALUES ($1, $2, $3, '{}'::jsonb, TRUE, $4::jsonb, $5, $5)
       RETURNING id`,
      [userId, tpl.id, dateStr, JSON.stringify(workoutData), sessionDate.toISOString()]
    );
    const sessionId = sessionRows[0].id;

    // Resolve master exercise ids for dual-write (exercise_id + exercise_name).
    const idByName = await resolveMasterExerciseIds(
      client,
      realRows.map((r) => r.name)
    );

    // Per-session weight delta — simulate progressive overload. i=0 (most
    // recent) is heaviest; older sessions trend lighter.
    const overloadOffset = (3 - i) * -5;  // i=0: 0, i=1: -5, i=2: -10, i=3: -15

    for (const row of realRows) {
      const planned = Number(row.planned_reps) || 10;
      const suggested = Number(row.suggested_weight) || 0;
      const baseWeight = suggested > 0 ? suggested : 100;
      const weight = Math.max(5, baseWeight + overloadOffset);
      // Hit planned reps, drop one rep on the last set sometimes (looks real).
      const reps = row.set_number >= 3 ? Math.max(1, planned - 1) : planned;
      const exId = idByName.get(String(row.name).trim().toLowerCase()) ?? null;
      await client.query(
        `INSERT INTO session_entries (session_id, exercise_id, exercise_name, set_number, weight, reps, is_completed)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
        [sessionId, exId, row.name, row.set_number, weight, reps]
      );
    }

    sessionsLogged.push({ sessionId, templateId: tpl.id, date: dateStr });
  }
  return sessionsLogged;
}

async function seedPersonalBests(client, userId, workoutTemplatePool) {
  // Insert 3 PRs against real exercises from the first workout template so
  // they line up with what the user actually trained. Match the personal_bests
  // column shape: (user_id, template_id, exercise_id, exercise_name,
  // best_weight, best_reps, achieved_at).
  const tpl = workoutTemplatePool[0];
  const rows = await getTemplateExercises(client, tpl.id);
  const realRows = rows.filter((r) => !r.is_section_header);
  // Group by exercise name, take 3 distinct names.
  const seen = new Set();
  const picks = [];
  for (const r of realRows) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    picks.push(r);
    if (picks.length === 3) break;
  }
  if (picks.length === 0) return 0;

  const now = new Date();
  const idByName = await resolveMasterExerciseIds(client, picks.map((p) => p.name));

  let inserted = 0;
  for (let i = 0; i < picks.length; i++) {
    const p = picks[i];
    const baseWeight = Number(p.suggested_weight) || 100;
    const pbWeight = baseWeight + 10;       // 10lb above what the program prescribes
    const pbReps = Number(p.planned_reps) || 8;
    const achievedAt = new Date(now);
    achievedAt.setUTCDate(now.getUTCDate() - (i + 1));
    const exId = idByName.get(String(p.name).trim().toLowerCase()) ?? null;
    await client.query(
      `INSERT INTO personal_bests (user_id, template_id, exercise_id, exercise_name, best_weight, best_reps, achieved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, template_id, exercise_name, best_weight)
       DO UPDATE SET best_reps = GREATEST(personal_bests.best_reps, EXCLUDED.best_reps),
                     achieved_at = EXCLUDED.achieved_at,
                     exercise_id = COALESCE(personal_bests.exercise_id, EXCLUDED.exercise_id)`,
      [userId, tpl.id, exId, p.name, pbWeight, pbReps, achievedAt.toISOString()]
    );
    inserted += 1;
  }
  return inserted;
}

async function seedCustomWorkout(client, userId) {
  // Find-or-create the user's "My Workouts" program (matches the start-empty
  // convention in server/routes/sessions.js). The partial unique index
  // idx_programs_user_lower_name covers (user_id, lower(name)) WHERE
  // user_id IS NOT NULL.
  const { rows: [programRow] } = await client.query(
    `INSERT INTO programs (user_id, name, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, lower(name)) WHERE user_id IS NOT NULL
     DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [userId, 'My Workouts', '']
  );
  const programId = programRow.id;

  // Pick next sort_order in the program.
  const { rows: sortRows } = await client.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM templates WHERE program_id = $1`,
    [programId]
  );
  const sortOrder = sortRows[0].next_sort;

  const templateName = 'Saturday Pump';
  const { rows: [tmpl] } = await client.query(
    `INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order)
     VALUES ($1, $2, $3, $4, FALSE, $5)
     RETURNING id`,
    [userId, programId, templateName, 'Custom upper-body finisher', sortOrder]
  );
  const templateId = tmpl.id;

  // 4 exercises, 3 sets each. Realistic accessory work.
  const exercises = [
    { name: 'Lat Pulldown',    sets: 3, plannedReps: 12, suggestedWeight: 120 },
    { name: 'Dumbbell Curl',   sets: 3, plannedReps: 10, suggestedWeight: 30  },
    { name: 'Tricep Pushdown', sets: 3, plannedReps: 12, suggestedWeight: 60  },
    { name: 'Lateral Raise',   sets: 3, plannedReps: 15, suggestedWeight: 15  },
  ];

  // Resolve exercise_ids so template_exercises.exercise_id stays in sync
  // with the master library where available.
  const idByName = await resolveMasterExerciseIds(client, exercises.map((e) => e.name));

  let sortIdx = 0;
  for (const ex of exercises) {
    const exId = idByName.get(String(ex.name).trim().toLowerCase()) ?? null;
    for (let setNumber = 1; setNumber <= ex.sets; setNumber++) {
      await client.query(
        `INSERT INTO template_exercises
           (template_id, exercise_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes)
         VALUES ($1, $2, $3, 'straight', $4, $5, $6, $7, FALSE, '')`,
        [templateId, exId, ex.name, setNumber, ex.plannedReps, ex.suggestedWeight, sortIdx]
      );
    }
    sortIdx += 1;
  }
  return { programId, templateId, count: 1 };
}

async function run() {
  console.log('--- Seed Apple Reviewer Account ---');
  console.log(`Target email: ${REVIEWER_EMAIL}`);
  console.log(`--force flag: ${FORCE ? 'YES' : 'no'}`);
  console.log('');

  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');

    // Inspect existing shapes BEFORE doing any writes so the inserts match
    // whatever the live app produces. Logs only; no assertions.
    await inspectSessionShape(client);
    await inspectPbShape(client);

    // Existence check (idempotency / safety).
    const { rows: existingRows } = await client.query(
      `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)`,
      [REVIEWER_EMAIL]
    );
    if (existingRows.length > 0) {
      if (!FORCE) {
        await client.query('ROLLBACK');
        console.log('');
        console.log(`Reviewer account already exists (user_id=${existingRows[0].id}).`);
        console.log('Use --force to wipe and recreate.');
        return;
      }
      console.log(`[force] Deleting existing reviewer user (id=${existingRows[0].id})...`);
      await deleteReviewerIfMatches(client);
    }

    const userId = await createReviewerUser(client);
    console.log(`Created user id=${userId}`);

    // Pick two library programs: PPL (preferred), Upper/Lower fallback.
    const ppl = await findLibraryProgram(client, [
      '%Push Pull Legs%',
      '%PPL%',
      '%Push, Pull%',
    ]);
    const upperLower = await findLibraryProgram(client, [
      '%Upper / Lower%',
      '%Upper/Lower%',
      '%Upper-Lower%',
    ]);
    let primary = ppl;
    let secondary = upperLower;
    if (!primary) {
      primary = await firstLibraryProgram(client);
      if (!primary) {
        throw new Error('No suitable library program found (user_id IS NULL, non-featured, has non-rest templates).');
      }
      console.log(`[fallback] No PPL match; using first library program "${primary.name}"`);
    } else {
      console.log(`Primary program: "${primary.name}" (id=${primary.id})`);
    }
    if (secondary) {
      console.log(`Secondary program: "${secondary.name}" (id=${secondary.id})`);
    } else {
      console.log('Secondary program: none found (Upper/Lower not in library); proceeding with primary only.');
    }
    const programs = secondary ? [primary, secondary] : [primary];

    const { scheduledCount, workoutTemplatePool } = await seedSchedule(client, userId, programs);
    console.log(`Schedule seeded: ${scheduledCount} days (${workoutTemplatePool.length} workout templates in rotation)`);

    const sessionsLogged = await seedSessions(client, userId, workoutTemplatePool);
    console.log(`Sessions logged: ${sessionsLogged.length}`);

    const pbCount = await seedPersonalBests(client, userId, workoutTemplatePool);
    console.log(`Personal bests inserted: ${pbCount}`);

    const custom = await seedCustomWorkout(client, userId);
    console.log(`Custom workout: program_id=${custom.programId}, template_id=${custom.templateId}`);

    await client.query('COMMIT');
    committed = true;

    console.log('');
    console.log('=================================');
    console.log('Reviewer account ready');
    console.log('=================================');
    console.log(`Email:    ${REVIEWER_EMAIL}`);
    console.log(`Password: ${REVIEWER_PASSWORD}`);
    console.log(`user_id:  ${userId}`);
    console.log('---------------------------------');
    console.log(`Scheduled days:    ${scheduledCount}`);
    console.log(`Sessions logged:   ${sessionsLogged.length}`);
    console.log(`Personal records:  ${pbCount}`);
    console.log(`Custom workouts:   ${custom.count}`);
    console.log('=================================');
  } catch (err) {
    if (!committed) {
      try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    }
    console.error('Seed failed:', err.message);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
