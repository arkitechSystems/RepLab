import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './dbPool.js';
import SEED_EXERCISES from './seedExercises.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function initDb() {
  // Run schema
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);

  // Migrations
  // Public 5-digit account identifier (distinct from the SERIAL id).
  // Sequence seeded at 23231; existing users are backfilled by
  // add-account-ids-starting-at-23231.js (idempotent).
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS users_account_id_seq START 23231`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id INT UNIQUE`);
  await pool.query(`ALTER TABLE users ALTER COLUMN account_id SET DEFAULT nextval('users_account_id_seq')`);

  await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS set_type TEXT DEFAULT 'straight'`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS rep_range TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS exercise_description TEXT DEFAULT ''`);
  // Per-exercise overrides for Robin Gallant program (and future xlsx imports):
  // video_url overrides the demo-button target; program_notes renders below the
  // exercise card as a static program-provided note (separate from user notes).
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS program_notes TEXT DEFAULT ''`);
  // Optional warm-up template attached to a workout. When set, the Begin
  // Workout flow asks the user if they want to run the prehab routine first.
  // is_prehab marks the template as a warm-up so the weekly view can hide it.
  await pool.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS prehab_template_id INT`);
  await pool.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS is_prehab BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '{}'`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE`);
  await pool.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_source TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'Free'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_device TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_content TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_term TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS zip_code TEXT`);
  // IANA timezone name captured on signup (e.g., 'America/Los_Angeles'). Used to
  // format dates in the user's local calendar instead of assuming server time.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_city TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_state TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`);
  // token_version is included in JWTs and compared in authMiddleware. Incremented
  // on password change so existing tokens for that user become invalid.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ`);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workout_data JSONB`);
  await pool.query(`ALTER TABLE session_entries ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS is_section_header BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS section_notes TEXT DEFAULT ''`);

  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);

  await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'other'`);

  // One-shot backfill: Robin Gallant's program was originally seeded as
  // 'hypertrophy'; reclassified to 'glute_focused' so it picks up the pink
  // pill + dedicated filter on the library card. Idempotent — only updates
  // the row if it's still on the old value.
  await pool.query(
    `UPDATE programs
     SET program_type = 'glute_focused'
     WHERE name = $1 AND program_type = 'hypertrophy'`,
    ["Robin Gallant's Intensive Max Glute Hypertrophy"]
  );

  // Role column for trainer/client designation (admin-set)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client'`);

  // Trainer-client relationship table
  await pool.query(`CREATE TABLE IF NOT EXISTS trainer_clients (
    id SERIAL PRIMARY KEY,
    trainer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trainer_id, client_id)
  )`);

  // Trainer application table
  await pool.query(`CREATE TABLE IF NOT EXISTS trainer_applications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // Indexes for common queries
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_programs_user_id ON programs(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_templates_program_id ON templates(program_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_template_exercises_template_id ON template_exercises(template_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_template_date ON sessions(user_id, template_id, date)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_session_entries_session_id ON session_entries(session_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_personal_bests_user_template ON personal_bests(user_id, template_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_personal_bests_lookup ON personal_bests(user_id, template_id, exercise_name, best_weight)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer ON trainer_clients(trainer_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trainer_clients_client ON trainer_clients(client_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trainer_applications_user ON trainer_applications(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trainer_applications_status ON trainer_applications(status)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS page_visits (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_user ON page_visits(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_page_visits_created ON page_visits(created_at)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS user_login_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    email TEXT,
    ip TEXT,
    user_agent TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_login_history_user ON user_login_history(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_login_history_created ON user_login_history(created_at)`);

  await pool.query(`CREATE TABLE IF NOT EXISTS shared_programs (
    id SERIAL PRIMARY KEY,
    source_program_id INT REFERENCES programs(id) ON DELETE SET NULL,
    sender_id INT NOT NULL REFERENCES users(id),
    recipient_id INT NOT NULL REFERENCES users(id),
    copied_program_id INT REFERENCES programs(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shared_programs_recipient ON shared_programs(recipient_id, status)`);
  // Every push notification send does `WHERE user_id = $1` on device_tokens;
  // without this, it's a full-table scan per send.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id)`);
  // Admin analytics query COUNT(DISTINCT user_id) on sessions in a date range.
  // idx_sessions_user_template_date doesn't cover created_at ranges.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_created_at ON sessions(user_id, created_at)`);
  // Stats endpoint filters PBs by user + achieved_at month boundary.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_personal_bests_user_achieved ON personal_bests(user_id, achieved_at)`);

  // Drop redundant indexes from earlier iterations:
  // - idx_personal_bests_upsert duplicates idx_personal_bests_lookup (same 4-col composite)
  // - idx_schedule_days_user_day is dead weight (day_of_week column was replaced
  //   by schedule_date; no query reads it anymore)
  await pool.query(`DROP INDEX IF EXISTS idx_personal_bests_upsert`);
  await pool.query(`DROP INDEX IF EXISTS idx_schedule_days_user_day`);

  // Rewrite shared_programs FKs to cascade on user deletion. db.deleteUser
  // already explicitly DELETEs these rows, but CASCADE is belt-and-suspenders
  // for GDPR erasure — any future path that deletes a user row without going
  // through db.deleteUser will still cleanly remove the shares.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints
        WHERE constraint_name = 'shared_programs_sender_id_fkey' AND delete_rule <> 'CASCADE'
      ) THEN
        ALTER TABLE shared_programs DROP CONSTRAINT shared_programs_sender_id_fkey;
        ALTER TABLE shared_programs ADD CONSTRAINT shared_programs_sender_id_fkey
          FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints
        WHERE constraint_name = 'shared_programs_recipient_id_fkey' AND delete_rule <> 'CASCADE'
      ) THEN
        ALTER TABLE shared_programs DROP CONSTRAINT shared_programs_recipient_id_fkey;
        ALTER TABLE shared_programs ADD CONSTRAINT shared_programs_recipient_id_fkey
          FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_completed_lookup ON sessions(user_id, template_id) WHERE completed = TRUE`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_schedule_days_user_id ON schedule_days(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON exercises(created_by)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_challenge_entries_user_challenge ON challenge_entries(user_id, challenge)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at)`);

  // Unique constraints for upserts
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_days_user_day ON schedule_days(user_id, day_of_week)`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_bests_upsert ON personal_bests(user_id, template_id, exercise_name, best_weight)`);

  // Migration: add schedule_date column and drop NOT NULL on day_of_week
  await pool.query(`ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS schedule_date DATE`);
  await pool.query(`ALTER TABLE schedule_days ALTER COLUMN day_of_week DROP NOT NULL`);
  // Clean up old day_of_week rows that don't have a schedule_date
  await pool.query(`DELETE FROM schedule_days WHERE schedule_date IS NULL`);
  // Ensure unique index exists for date-based scheduling
  await pool.query(`DROP INDEX IF EXISTS idx_schedule_days_user_date`);
  await pool.query(`CREATE UNIQUE INDEX idx_schedule_days_user_date ON schedule_days(user_id, schedule_date)`);

  // Migration: add is_rest column to schedule_days for standalone rest days
  await pool.query(`ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS is_rest BOOLEAN DEFAULT FALSE`);

  // Migration: add group_id to templates for linking repeated workouts across weeks
  await pool.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS group_id TEXT`);
  // Migration: add is_featured flag to programs
  await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE`);

  // Migration: device_tokens table for push notifications
  await pool.query(`CREATE TABLE IF NOT EXISTS device_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL UNIQUE,
    platform TEXT DEFAULT 'ios',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // Migration: short-name lookup for library programs. Display-only — the
  // canonical full name stays on the programs row.
  await pool.query(`CREATE TABLE IF NOT EXISTS program_name_abbreviations (
    full_name TEXT PRIMARY KEY,
    short_name TEXT NOT NULL
  )`);
  // Seed (idempotent — ON CONFLICT updates the short_name so editing a row
  // here is the way to change a program's display abbreviation).
  await pool.query(`
    INSERT INTO program_name_abbreviations (full_name, short_name) VALUES
      ('Will''s Hypertrophy Program',                              'Will''s Hypertrophy'),
      ('Mike Mentzer Workout',                                     'Mentzer'),
      ('Athlean-X Summer Shred',                                   'Summer Shred'),
      ('Smolov Squat & Bench Program',                             'Smolov S&B'),
      ('Muscle & Fitness 5000 Rep Arm Specialization',             'M&F 5000 Arms'),
      ('Jim Stoppani''s Shortcut to Shred',                        'Shortcut to Shred'),
      ('Robin Gallant''s Intensive Max Glute Hypertrophy',         'RG''s Max Glute'),
      ('Jeff Nippard''s Push Pull Legs',                           'Nippard''s PPL'),
      ('Katie Sonier''s 6-Week Glute Building Program',            'Katie''s Glutes')
    ON CONFLICT (full_name) DO UPDATE SET short_name = EXCLUDED.short_name
  `);

  // Migration: trainer_sessions DB-backed session table (replaces in-memory Map
  // so server restarts don't log every trainer out).
  await pool.query(`CREATE TABLE IF NOT EXISTS trainer_sessions (
    id SERIAL PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trainer_sessions_token ON trainer_sessions(token_hash)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trainer_sessions_expires ON trainer_sessions(expires_at)`);

  // Migration: password reset audit log. One row per reset request; used_at
  // is populated when the token is consumed.
  await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_log (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    request_ip TEXT,
    use_ip TEXT,
    user_agent TEXT
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_log_user ON password_reset_log(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_log_token ON password_reset_log(token_hash)`);

  // Add WARM UP section header to "Leg 1 (anterior chain)" before Leg Press (one-time migration)
  const { rows: leg1Templates } = await pool.query(
    `SELECT t.id FROM templates t JOIN programs p ON t.program_id = p.id WHERE t.name ILIKE '%Leg 1%' AND p.name ILIKE '%Upper/Lower/PPL%' LIMIT 1`
  );
  if (leg1Templates.length > 0) {
    const tplId = leg1Templates[0].id;
    const { rows: existing } = await pool.query(
      `SELECT id FROM template_exercises WHERE template_id = $1 AND is_section_header = true AND name = 'WARM UP'`, [tplId]
    );
    if (existing.length === 0) {
      // Find the sort_order of Leg Press
      const { rows: lpRows } = await pool.query(
        `SELECT DISTINCT sort_order FROM template_exercises WHERE template_id = $1 AND name ILIKE '%Leg Press%' ORDER BY sort_order LIMIT 1`, [tplId]
      );
      if (lpRows.length > 0) {
        const lpOrder = lpRows[0].sort_order;
        // Shift all exercises at or after this sort_order up by 1
        await pool.query(
          `UPDATE template_exercises SET sort_order = sort_order + 1 WHERE template_id = $1 AND sort_order >= $2`, [tplId, lpOrder]
        );
        // Insert WARM UP section header at the Leg Press's old position
        await pool.query(
          `INSERT INTO template_exercises (template_id, name, set_type, set_number, planned_reps, suggested_weight, sort_order, is_section_header, section_notes) VALUES ($1, 'WARM UP', 'straight', 1, 0, 0, $2, true, '5 min light cardio, dynamic stretches')`,
          [tplId, lpOrder]
        );
        console.log('Added WARM UP section header to Leg 1 template');
      }
    }
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS trainer_login_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    email TEXT,
    ip TEXT,
    user_agent TEXT,
    city TEXT,
    state TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`ALTER TABLE trainer_login_history ADD COLUMN IF NOT EXISTS city TEXT`);
  await pool.query(`ALTER TABLE trainer_login_history ADD COLUMN IF NOT EXISTS state TEXT`);

  // Workout invite support on shared_programs
  await pool.query(`ALTER TABLE shared_programs ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'program'`);
  await pool.query(`ALTER TABLE shared_programs ADD COLUMN IF NOT EXISTS template_id INT`);
  await pool.query(`ALTER TABLE shared_programs ADD COLUMN IF NOT EXISTS message TEXT`);

  await pool.query(`CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    html TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS ai_usage (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    model TEXT,
    cost_cents NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // New tables for admin features
  await pool.query(`CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    description TEXT DEFAULT ''
  )`);

  // Rename Face Pulls to Cable Warm Up in Will's Pull 1
  await pool.query(`
    UPDATE template_exercises SET name = 'Cable Warm Up with Rope Attachment'
    WHERE name = 'Face Pulls' AND template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND sort_order = 0
  `, ["Will's Pull 1", "Will's PPL"]);

  // Remove Straight-Arm Pulldowns, Cable Rows, Hammer Curls (warm-up) from Will's Pull 1
  // and change Single-Arm Cable Curls to 1 set of 50
  await pool.query(`
    DELETE FROM template_exercises WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND name IN ('Straight-Arm Pulldowns', 'Cable Rows', 'Hammer Curls (warm-up)')
    AND sort_order IN (1, 2, 3)
  `, ["Will's Pull 1", "Will's PPL"]);

  await pool.query(`
    UPDATE template_exercises SET planned_reps = 50, exercise_description = '50 total reps per arm.'
    WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND name = 'Single-Arm Cable Curls'
  `, ["Will's Pull 1", "Will's PPL"]);

  // Delete extra sets for Single-Arm Cable Curls (keep only set_number 1)
  await pool.query(`
    DELETE FROM template_exercises WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND name = 'Single-Arm Cable Curls' AND set_number > 1
  `, ["Will's Pull 1", "Will's PPL"]);

  // Update warm-up superset descriptions in Will's Pull 1
  await pool.query(`
    UPDATE template_exercises SET exercise_description = 'Superset: Face Pulls, Straight-Arm Pulldowns, Cable Rows, Hammer Curls'
    WHERE template_id IN (
      SELECT t.id FROM templates t
      JOIN programs p ON t.program_id = p.id
      WHERE t.name = $1 AND p.name = $2 AND t.user_id IS NULL
    ) AND sort_order IN (0, 1, 2, 3)
  `, ["Will's Pull 1", "Will's PPL"]);

  // Exercises table + seed
  await pool.query(`CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_custom BOOLEAN DEFAULT FALSE,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  const { rows: exCount } = await pool.query('SELECT COUNT(*) FROM exercises');
  if (parseInt(exCount[0].count) === 0) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const ex of SEED_EXERCISES) {
        await client.query(
          'INSERT INTO exercises (name, muscle_group, tags, is_custom, created_by) VALUES ($1, $2, $3, FALSE, NULL)',
          [ex.name, ex.muscle, ex.tags]
        );
      }
      await client.query('COMMIT');
      console.log('Seeded exercise library');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Video ID column for exercise YouTube videos
  await pool.query(`ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_id TEXT`);

  // Streak-reminder push de-dupe: track when we last pinged a given user so
  // the scheduler doesn't double-send across overlapping ticks. 18h cooldown
  // matches the daily-evening cadence.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_streak_reminder_at TIMESTAMPTZ`);

  // Programs that run cardio acceleration between sets (Jim Stoppani-style
  // conditioning). Opt-in per program; the WorkoutSession UI reads this flag
  // to decide whether to render between-set cardio cards.
  await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS cardio_acceleration_enabled BOOLEAN DEFAULT FALSE`);

  // Rich program description surfaced as an expandable card at the top of
  // the Browse Library weekly view. Flexible JSON so different programs can
  // carry different field sets (goal, duration, equipment, overview, etc).
  await pool.query(`ALTER TABLE programs ADD COLUMN IF NOT EXISTS program_details JSONB`);

  // Optional phase label on templates (e.g. "Phase 1" / "Phase 2"). Used by
  // the Browse Library weekly view to group weeks by phase.
  await pool.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS phase TEXT`);

  // Idle-session push reminder tracking.
  // last_activity_at: updated each time the user completes a set (or otherwise
  // interacts with an in-progress session). reminder_sent_at: set when we
  // push "You forgot to mark your workout complete." to make the send
  // idempotent per session.
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`);
  // Partial index to make the reminder-checker sweep cheap.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_idle_reminder ON sessions(last_activity_at) WHERE completed = FALSE AND reminder_sent_at IS NULL`);

  console.log('Database schema initialized');

  // Seed default program if none exist
  const { rows } = await pool.query('SELECT COUNT(*) FROM programs');
  if (parseInt(rows[0].count) === 0) {
    await seedDefaults();
  }

  // Remove Upper/Lower program from library (deprecated)
  await pool.query("DELETE FROM programs WHERE name = 'Upper/Lower' AND user_id IS NULL");

  // Remove deprecated library programs
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ["ZJ's Workout"]);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['Push, Pull, Legs']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['Science-Based Upper/Lower (Jeff Nippard Inspired)']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['nSuns 5/3/1 LP']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['Creeping Death (John Meadows Inspired)']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['GZCL Method']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['PHAT (Power Hypertrophy Adaptive Training)']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['PHUL (Power Hypertrophy Upper Lower)']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['German Volume Training (GVT)']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['Bro Split Workout']);
  await pool.query("DELETE FROM programs WHERE name = $1 AND user_id IS NULL", ['Glute Hypertrophy']);

  // Will's PPL was moved out of the public library and into Will Martin's
  // personal workouts (user_id=37) on 2026-04-24 via
  // server/migrations/move-wills-programs-to-wmartin23.js. Seeding it here
  // would resurrect a library copy on a fresh DB, so the seed/expand calls
  // below are intentionally left dormant. Helper functions (seedWillsPPL,
  // seedWillsLegs2, seedWillsPush1, expandPPLto7Days, expandPPLto4Weeks)
  // are kept so the original program can still be re-imported manually
  // into a user's own workouts later if needed.

  // Challenge entries table
  await pool.query(`CREATE TABLE IF NOT EXISTS challenge_entries (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    value INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // PPL expansion migration removed — Will's PPL is no longer in the public
  // library (see comment above near the seed block). The user_id IS NULL
  // lookup wouldn't match the migrated program anyway.

  // ZJ's Workout removed from library — no longer seeded

  // Seed or expand Mike Mentzer Workout
  const { rows: mmRows } = await pool.query("SELECT id FROM programs WHERE name = $1 AND user_id IS NULL", ['Mike Mentzer Workout']);
  if (mmRows.length === 0) {
    await seedMikeMentzer();
  } else {
    // Expand to 28 days if still the old 4-template version
    const mmId = mmRows[0].id;
    const { rows: mmCount } = await pool.query("SELECT COUNT(*)::int AS cnt FROM templates WHERE program_id = $1", [mmId]);
    if (mmCount[0].cnt < 28) {
      try {
        await pool.query("DELETE FROM templates WHERE program_id = $1", [mmId]);
        await pool.query("UPDATE programs SET description = $1 WHERE id = $2", ['4-week Heavy Duty program — 4-day cycle with 1 working set to failure', mmId]);
        await seedMikeMentzerTemplates(mmId);
        console.log('Expanded Mike Mentzer Workout to 28 days');
      } catch (err) {
        console.error('Mike Mentzer expansion failed (non-fatal):', err.message);
      }
    }
  }

  // Push, Pull, Legs program removed from library — no longer seeded or expanded

  // Seed Will's Hypertrophy Program (featured) if not present
  const { rows: featRows } = await pool.query("SELECT id FROM programs WHERE name = $1 AND user_id IS NULL", ["Will's Hypertrophy Program"]);
  if (featRows.length === 0) {
    await seedWillsHypertrophy();
  } else {
    // Ensure it's marked as featured
    await pool.query("UPDATE programs SET is_featured = TRUE WHERE id = $1", [featRows[0].id]);
  }
}

async function seedWillsHypertrophy() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [prog] } = await client.query(
      "INSERT INTO programs (user_id, name, description, is_featured, program_type) VALUES (NULL, $1, $2, TRUE, 'hypertrophy') RETURNING id",
      ["Will's Hypertrophy Program", "12 Week Resistance Training Program focused on muscle hypertrophy"]
    );
    const programId = prog.id;

    // 6 workout days + 1 rest day per week, repeated for 12 weeks
    // Each workout day shares a group_id so progressive overload links across weeks
    // A variants (odd weeks: 1, 3, 5, 7, 9, 11) — no goal weights, only sets and reps
    const daysA = [
      {
        name: 'Chest A', groupId: 'wills_hypertrophy_chest_a',
        description: 'Chest — bench warm-up, working sets, 10×10 incline, cable flyes, pec deck, max push-ups',
        exercises: [
          { name: 'Barbell Bench', setType: 'warm_up', sets: [{r:6,w:0},{r:5,w:0},{r:2,w:0},{r:2,w:0}] },
          { name: 'Barbell Bench', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] },
          { name: 'DB Incline Bench Press', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0},{r:10,w:0},{r:10,w:0},{r:10,w:0},{r:10,w:0},{r:10,w:0},{r:10,w:0},{r:10,w:0}] },
          { name: 'Straight Arm Kneeling Upper Chest Cable Flyes', sets: [{r:15,w:0},{r:15,w:0},{r:15,w:0}] },
          { name: 'Pec Deck Flyes', sets: [{r:15,w:0},{r:15,w:0},{r:15,w:0}] },
          { name: 'Max Push-Ups', sets: [{r:0,w:0}] },
        ],
      },
      {
        name: 'Bis/RDs A', groupId: 'wills_hypertrophy_bis_rds_a',
        description: 'Biceps, Rear Delts — supersets, cable work, isolation burnouts',
        exercises: [
          { name: 'Cable Warm Up (Rope)', sets: [{r:15,w:0},{r:15,w:0},{r:15,w:0}] },
          { name: 'Single-Arm Cable Curls', sets: [{r:25,w:0},{r:25,w:0}] },
          { name: 'Supinated Weighted Pull-Ups', sets: [{r:6,w:0},{r:6,w:0},{r:6,w:0}] },
          { name: 'Barbell Shrugs', sets: [{r:12,w:0},{r:12,w:0},{r:12,w:0}] },
          { name: 'Hammer Curls', sets: [{r:12,w:0},{r:12,w:0},{r:12,w:0}] },
          { name: 'Banded Preacher Curls', sets: [{r:12,w:0},{r:12,w:0},{r:12,w:0}] },
          { name: 'Wide-Grip Cable Pulldowns', sets: [{r:12,w:0},{r:12,w:0},{r:12,w:0}] },
        ],
      },
      {
        name: 'Quads A', groupId: 'wills_hypertrophy_quads_a',
        description: 'Quads, Calves — extensions, squats, leg press, calf work',
        exercises: [
          { name: 'Leg Extensions', sets: [{r:12,w:0},{r:12,w:0},{r:10,w:0}] },
          { name: 'Leg Curls', sets: [{r:12,w:0},{r:12,w:0},{r:10,w:0}] },
          { name: 'Single Leg Leg Press', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] },
          { name: 'BB Lunges', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] },
          { name: 'BB Squats', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] },
          { name: 'Standing Calf Raises', sets: [{r:15,w:0},{r:15,w:0},{r:15,w:0}] },
        ],
      },
      {
        name: 'Tris/Shoulders A', groupId: 'wills_hypertrophy_tris_shoulders_a',
        description: 'Triceps, Shoulders — pressing movements, isolation burnouts',
        exercises: [
          { name: 'Seated Shoulder Press (DB)', sets: [{r:10,w:0},{r:10,w:0},{r:8,w:0}] },
          { name: 'Lateral Raises', sets: [{r:15,w:0},{r:15,w:0},{r:12,w:0}] },
          { name: 'Cable Tricep Pushdowns', sets: [{r:12,w:0},{r:12,w:0},{r:10,w:0}] },
          { name: 'Overhead Tricep Extension (rope)', sets: [{r:12,w:0},{r:10,w:0},{r:10,w:0}] },
          { name: 'Front Raises', sets: [{r:12,w:0},{r:12,w:0},{r:12,w:0}] },
          { name: 'Close-Grip Bench Press', sets: [{r:10,w:0},{r:8,w:0},{r:8,w:0}] },
        ],
      },
      {
        name: 'Back/Traps A', groupId: 'wills_hypertrophy_back_traps_a',
        description: 'Back, Traps — rows, pulldowns, shrugs, rear delt work',
        exercises: [
          { name: 'Lat Pulldown', sets: [{r:12,w:0},{r:10,w:0},{r:8,w:0}] },
          { name: 'Barbell Row', sets: [{r:10,w:0},{r:8,w:0},{r:8,w:0}] },
          { name: 'Seated Cable Row', sets: [{r:12,w:0},{r:12,w:0},{r:10,w:0}] },
          { name: 'Face Pulls', sets: [{r:15,w:0},{r:15,w:0},{r:12,w:0}] },
          { name: 'Barbell Shrugs', sets: [{r:12,w:0},{r:12,w:0},{r:10,w:0}] },
          { name: 'Rear Delt Fly', sets: [{r:15,w:0},{r:15,w:0},{r:12,w:0}] },
        ],
      },
      {
        name: 'Glutes/Hams A', groupId: 'wills_hypertrophy_glutes_hams_a',
        description: 'Glutes, Hamstrings — RDLs, hip thrusts, leg curls, walking lunges',
        exercises: [
          { name: 'Romanian Deadlift', sets: [{r:10,w:0},{r:10,w:0},{r:8,w:0}] },
          { name: 'Hip Thrust', sets: [{r:12,w:0},{r:12,w:0},{r:10,w:0}] },
          { name: 'Leg Curls', sets: [{r:12,w:0},{r:12,w:0},{r:10,w:0}] },
          { name: 'DB Walking Lunges', sets: [{r:20,w:0},{r:20,w:0}] },
          { name: 'Hip Abduction', sets: [{r:15,w:0},{r:15,w:0}] },
          { name: 'Hip Adduction', sets: [{r:15,w:0},{r:15,w:0}] },
        ],
      },
    ];

    // B variants (even weeks: 2, 4, 6, 8, 10, 12) — placeholders, same exercises for now
    const daysB = [
      { name: 'Chest B', groupId: 'wills_hypertrophy_chest_b', description: 'Chest B — alternate chest workout (to be customized)', exercises: [{ name: 'Barbell Bench', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] }] },
      { name: 'Bis/RDs B', groupId: 'wills_hypertrophy_bis_rds_b', description: 'Biceps, Rear Delts B — alternate (to be customized)', exercises: [{ name: 'Hammer Curls', sets: [{r:12,w:0},{r:12,w:0},{r:12,w:0}] }] },
      { name: 'Quads B', groupId: 'wills_hypertrophy_quads_b', description: 'Quads B — alternate (to be customized)', exercises: [{ name: 'BB Squats', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] }] },
      { name: 'Tris/Shoulders B', groupId: 'wills_hypertrophy_tris_shoulders_b', description: 'Tris/Shoulders B — alternate (to be customized)', exercises: [{ name: 'Seated Shoulder Press (DB)', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] }] },
      { name: 'Back/Traps B', groupId: 'wills_hypertrophy_back_traps_b', description: 'Back/Traps B — alternate (to be customized)', exercises: [{ name: 'Barbell Row', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] }] },
      { name: 'Glutes/Hams B', groupId: 'wills_hypertrophy_glutes_hams_b', description: 'Glutes/Hams B — alternate (to be customized)', exercises: [{ name: 'Romanian Deadlift', sets: [{r:10,w:0},{r:10,w:0},{r:10,w:0}] }] },
    ];

    // Create 12 weeks: odd weeks use A variants, even weeks use B variants
    for (let week = 0; week < 12; week++) {
      const isOddWeek = week % 2 === 0; // week 0 = Week 1 (odd), week 1 = Week 2 (even), etc.
      const days = isOddWeek ? daysA : daysB;

      for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
        const day = days[dayIdx];
        const sortOrder = week * 7 + dayIdx;
        const weekLabel = week > 0 ? ` (Week ${week + 1})` : '';
        // Display name without A/B suffix — just the body part + week
        const displayName = day.name.replace(/ [AB]$/, '');

        const { rows: [tmpl] } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order, group_id) VALUES (NULL, $1, $2, $3, FALSE, $4, $5) RETURNING id',
          [programId, `${displayName}${weekLabel}`, day.description, sortOrder, day.groupId]
        );

        let exSortOrder = 0;
        for (const ex of day.exercises) {
          for (let i = 0; i < ex.sets.length; i++) {
            await client.query(
              'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, set_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
              [tmpl.id, ex.name, i + 1, ex.sets[i].r, ex.sets[i].w, exSortOrder, ex.setType || 'straight']
            );
          }
          exSortOrder++;
        }
      }

      // Rest day at end of each week
      const restSort = week * 7 + 6;
      const restLabel = week > 0 ? ` (Week ${week + 1})` : '';
      await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, TRUE, $4)',
        [programId, `Rest${restLabel}`, 'Recovery Day', restSort]
      );
    }

    await client.query('COMMIT');
    console.log("Seeded Will's Hypertrophy Program (featured, 12 weeks)");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Failed to seed Will's Hypertrophy Program:", err.message);
  } finally {
    client.release();
  }
}

async function seedDefaults() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create default program
    const { rows: [program] } = await client.query(
      'INSERT INTO programs (user_id, name) VALUES (NULL, $1) RETURNING id',
      ['Push, Pull, Legs']
    );
    const programId = program.id;

    // Base week template: Push, Pull, Legs, Push, Pull, Legs, Rest
    const baseWorkouts = [
      {
        name: 'Push',
        description: 'Chest, Shoulders, Triceps',
        exercises: [
          { name: 'Barbell Bench Press', sets: [{ reps: 10, weight: 135 }, { reps: 8, weight: 155 }, { reps: 6, weight: 175 }, { reps: 6, weight: 175 }] },
          { name: 'Incline Dumbbell Press', sets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 50 }, { reps: 8, weight: 55 }] },
          { name: 'Seated Shoulder Press (DB)', sets: [{ reps: 12, weight: 40 }, { reps: 10, weight: 45 }, { reps: 8, weight: 50 }] },
          { name: 'Lateral Raises', sets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 20 }, { reps: 12, weight: 25 }] },
          { name: 'Cable Tricep Pushdown', sets: [{ reps: 12, weight: 60 }, { reps: 12, weight: 70 }, { reps: 10, weight: 80 }] },
          { name: 'Overhead Tricep Extension (rope)', sets: [{ reps: 12, weight: 50 }, { reps: 10, weight: 60 }, { reps: 10, weight: 60 }] },
        ],
      },
      {
        name: 'Pull',
        description: 'Back, Rear Delts, Biceps',
        exercises: [
          { name: 'Lat Pulldown', sets: [{ reps: 12, weight: 120 }, { reps: 10, weight: 140 }, { reps: 8, weight: 160 }] },
          { name: 'Barbell Row', sets: [{ reps: 10, weight: 135 }, { reps: 8, weight: 155 }, { reps: 8, weight: 155 }] },
          { name: 'Seated Cable Row', sets: [{ reps: 12, weight: 120 }, { reps: 12, weight: 130 }, { reps: 10, weight: 140 }] },
          { name: 'Face Pulls', sets: [{ reps: 15, weight: 50 }, { reps: 15, weight: 60 }, { reps: 12, weight: 70 }] },
          { name: 'Barbell Curl', sets: [{ reps: 12, weight: 65 }, { reps: 10, weight: 75 }, { reps: 8, weight: 85 }] },
          { name: 'Hammer Curl (DB)', sets: [{ reps: 12, weight: 30 }, { reps: 10, weight: 35 }, { reps: 10, weight: 35 }] },
        ],
      },
      {
        name: 'Legs',
        description: 'Quads, Hamstrings, Glutes, Calves',
        exercises: [
          { name: 'Back Squat', sets: [{ reps: 10, weight: 185 }, { reps: 8, weight: 205 }, { reps: 6, weight: 225 }, { reps: 6, weight: 225 }] },
          { name: 'Romanian Deadlift', sets: [{ reps: 10, weight: 135 }, { reps: 10, weight: 155 }, { reps: 8, weight: 185 }] },
          { name: 'Leg Press', sets: [{ reps: 12, weight: 270 }, { reps: 12, weight: 320 }, { reps: 10, weight: 360 }] },
          { name: 'Leg Curl', sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 100 }, { reps: 10, weight: 110 }] },
          { name: 'Leg Extension', sets: [{ reps: 12, weight: 110 }, { reps: 12, weight: 120 }, { reps: 10, weight: 130 }] },
          { name: 'Standing Calf Raise', sets: [{ reps: 15, weight: 140 }, { reps: 15, weight: 160 }, { reps: 12, weight: 180 }] },
        ],
      },
    ];

    // Generate 6 weeks: weight increases +5 lbs every 2 weeks
    // Weeks 1-2: base, Weeks 3-4: +5, Weeks 5-6: +10
    for (let week = 1; week <= 6; week++) {
      const weightBonus = Math.floor((week - 1) / 2) * 5; // 0, 0, 5, 5, 10, 10
      const weekOffset = (week - 1) * 7;
      const weekLabel = week > 1 ? ` (Week ${week})` : '';

      // 6 workouts per week: Push, Pull, Legs, Push, Pull, Legs
      for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
        const base = baseWorkouts[dayIdx % 3];
        const sortOrder = weekOffset + dayIdx;
        const name = `${base.name}${weekLabel}`;

        const { rows: [tmpl] } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
          [programId, name, base.description, sortOrder]
        );

        let exSortOrder = 0;
        for (const ex of base.exercises) {
          for (let i = 0; i < ex.sets.length; i++) {
            await client.query(
              'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
              [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight + weightBonus, exSortOrder]
            );
          }
          exSortOrder++;
        }
      }

      // Rest day at end of each week
      const restName = week > 1 ? `Rest (Week ${week})` : 'Rest';
      await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, TRUE, $4)',
        [programId, restName, 'Recovery Day', weekOffset + 6]
      );
    }

    await client.query('COMMIT');
    console.log('Seeded default workout templates');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedBroSplit() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, 'Bro Split Workout', '5-day muscle group split') RETURNING id"
    );
    const programId = program.id;

    const workouts = [
      {
        name: 'Chest',
        description: 'Bench Press, Incline, Fly, Dips',
        sortOrder: 0,
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, repRange: '5-8', description: 'Heavy compound chest movement that develops overall pressing strength and stimulates the chest, shoulders, and triceps.' },
          { name: 'Incline Dumbbell Press', sets: 3, repRange: '8-10', description: 'Targets the upper chest and allows a greater stretch than a barbell press.' },
          { name: 'Chest Fly', sets: 3, repRange: '10-12', description: 'Isolation movement focusing on chest contraction and stretch.' },
          { name: 'Chest Dips', sets: 3, repRange: '8-12', description: 'Bodyweight pressing movement that emphasizes the lower chest.' },
        ],
      },
      {
        name: 'Back',
        description: 'Pull-Ups, Barbell Row, Lat Pulldown, Face Pulls',
        sortOrder: 1,
        exercises: [
          { name: 'Pull-Ups', sets: 4, repRange: '6-10', description: 'Vertical pulling exercise targeting the lats and upper back.' },
          { name: 'Barbell Row', sets: 3, repRange: '6-8', description: 'Heavy horizontal pull that builds mid-back thickness.' },
          { name: 'Lat Pulldown', sets: 3, repRange: '8-12', description: 'Machine-based pulling movement emphasizing lat activation.' },
          { name: 'Face Pulls', sets: 3, repRange: '12-15', description: 'Targets rear delts and upper back for shoulder health and posture.' },
        ],
      },
      {
        name: 'Shoulders',
        description: 'Overhead Press, Lateral Raises, Rear Delt Fly',
        sortOrder: 2,
        exercises: [
          { name: 'Overhead Press', sets: 4, repRange: '6-8', description: 'Compound shoulder movement targeting the anterior delts and triceps.' },
          { name: 'Lateral Raises', sets: 4, repRange: '12-15', description: 'Isolation exercise that builds shoulder width by targeting the side delts.' },
          { name: 'Rear Delt Fly', sets: 3, repRange: '12-15', description: 'Targets the rear deltoids to balance shoulder development.' },
        ],
      },
      {
        name: 'Arms',
        description: 'Barbell Curls, Hammer Curls, Skull Crushers, Pushdowns',
        sortOrder: 3,
        exercises: [
          { name: 'Barbell Curls', sets: 3, repRange: '8-10', description: 'Primary biceps movement for overall arm development.' },
          { name: 'Hammer Curls', sets: 3, repRange: '10-12', description: 'Targets the brachialis and forearms.' },
          { name: 'Skull Crushers', sets: 3, repRange: '8-10', description: 'Triceps movement emphasizing elbow extension strength.' },
          { name: 'Tricep Pushdowns', sets: 3, repRange: '10-12', description: 'Isolation exercise focusing on triceps contraction.' },
        ],
      },
      {
        name: 'Legs',
        description: 'Squat, Leg Press, Extensions, Curls, Calves',
        sortOrder: 4,
        exercises: [
          { name: 'Back Squat', sets: 4, repRange: '5-8', description: 'Primary lower-body compound movement targeting quads, glutes, and core.' },
          { name: 'Leg Press', sets: 3, repRange: '8-12', description: 'Machine movement allowing heavy quad stimulation with less spinal loading.' },
          { name: 'Leg Extension', sets: 3, repRange: '10-12', description: 'Isolation exercise emphasizing the quadriceps.' },
          { name: 'Hamstring Curl', sets: 3, repRange: '10-12', description: 'Isolation movement targeting the hamstrings.' },
          { name: 'Standing Calf Raises', sets: 4, repRange: '12-15', description: 'Isolation exercise strengthening the calves.' },
        ],
      },
      {
        name: 'Rest',
        description: 'Recovery Day',
        sortOrder: 5,
        isRest: true,
        exercises: [],
      },
    ];

    for (const w of workouts) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [programId, w.name, w.description, w.isRest || false, w.sortOrder]
      );

      let sortOrder = 0;
      for (const ex of w.exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
            [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, sortOrder, ex.repRange, ex.description]
          );
        }
        sortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log('Seeded Bro Split Workout program');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedBootyRevolution() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, 'Glute Hypertrophy', '6-week glute-focused program built around hip thrusts, sumo squats, posterior chain work, and conditioning') RETURNING id"
    );
    const programId = program.id;

    const workouts = [
      {
        name: 'Glute Strength + Upper',
        description: 'Primary glute strength day with upper-body accessories for balance',
        sortOrder: 0,
        exercises: [
          { name: 'Hip Thrust', sets: 3, repRange: '8', description: 'Primary glute hypertrophy lift focused on powerful hip extension and peak glute contraction.' },
          { name: 'Back Hyperextension', sets: 3, repRange: '8', description: 'Posterior chain movement targeting glutes, hamstrings, and spinal erectors.' },
          { name: 'Dumbbell Sumo Squat', sets: 3, repRange: '8', description: 'Wide-stance squat variation emphasizing glutes, inner thighs, and quads.' },
          { name: 'Prone Glute Leg Raise', sets: 3, repRange: '8', description: 'Glute isolation movement focused on hip extension and glute activation.' },
          { name: 'Pull-Ups', sets: 3, repRange: '6', description: 'Vertical pulling exercise for upper-back and lat development.' },
          { name: 'Dumbbell Lateral Raise', sets: 3, repRange: '8', description: 'Shoulder isolation exercise targeting the side delts.' },
          { name: 'Overhead Triceps Extension', sets: 3, repRange: '8', description: 'Triceps isolation movement emphasizing the long head.' },
          { name: 'Close-Grip Push-Ups', sets: 3, repRange: '8', description: 'Bodyweight pressing movement targeting triceps, chest, and front delts.' },
        ],
      },
      {
        name: 'Glute Conditioning',
        description: 'Low-load activation day to improve recovery and glute blood flow',
        sortOrder: 1,
        exercises: [
          { name: 'Cardio', sets: 1, repRange: '30 min', description: 'Moderate steady-state cardio for conditioning and recovery.' },
          { name: 'Band Walks', sets: 4, repRange: '25', description: 'Lateral glute activation drill targeting glute medius and hip stability.' },
          { name: 'Glute Bridge', sets: 3, repRange: '15', description: 'Beginner-friendly glute movement to reinforce glute contraction and hip extension.' },
          { name: 'Bodyweight Frog Pumps', sets: 3, repRange: '20', description: 'High-rep glute burnout exercise emphasizing constant tension.' },
          { name: 'Standing Kickbacks', sets: 3, repRange: '15', description: 'Isolation movement targeting the glutes with controlled hip extension.' },
        ],
      },
      {
        name: 'Posterior Chain',
        description: 'Heavy posterior-chain day emphasizing glutes and hamstrings',
        sortOrder: 2,
        exercises: [
          { name: 'Good Morning', sets: 4, repRange: '5-12', description: 'Hip hinge movement targeting glutes, hamstrings, and lower back. Use controlled technique.' },
          { name: 'Romanian Deadlift', sets: 4, repRange: '8-10', description: 'Glute and hamstring builder focused on eccentric control and hip hinge mechanics.' },
          { name: 'Walking Lunges', sets: 3, repRange: '10', description: 'Unilateral leg exercise that develops glutes, quads, and balance.' },
          { name: 'Hamstring Curl', sets: 3, repRange: '10-12', description: 'Isolation exercise for hamstrings to support posterior chain growth.' },
          { name: 'Cable Pull-Through', sets: 3, repRange: '12-15', description: 'Glute-focused hinge movement emphasizing hip extension with lower spinal loading.' },
          { name: 'Plank', sets: 3, repRange: '30-45s', description: 'Core stabilization movement to support posture and bracing during heavy lower-body lifts.' },
        ],
      },
      {
        name: 'Glute Strength + Accessories',
        description: 'Second strength-focused glute day with single-leg work and accessories',
        sortOrder: 3,
        exercises: [
          { name: 'Barbell Hip Thrust', sets: 4, repRange: '8-10', description: 'Main glute builder focused on heavy loading and full hip lockout.' },
          { name: 'Bulgarian Split Squat', sets: 3, repRange: '8-10', description: 'Unilateral lower-body movement emphasizing glutes and quads.' },
          { name: 'Leg Press', sets: 3, repRange: '10-12', description: 'Lower-body compound movement allowing controlled volume for glutes and quads.' },
          { name: 'Dumbbell Step-Ups', sets: 3, repRange: '10', description: 'Functional unilateral movement that trains glutes, quads, and balance.' },
          { name: 'Cable Glute Kickback', sets: 3, repRange: '12-15', description: 'Isolation exercise for glute max with strong peak contraction.' },
          { name: 'Seated Abduction Machine', sets: 3, repRange: '15-20', description: 'Glute medius-focused movement for upper glute and hip stability development.' },
        ],
      },
      {
        name: 'Glute Pump + Conditioning',
        description: 'Higher-rep glute burnout day with metabolic stress and conditioning',
        sortOrder: 4,
        exercises: [
          { name: 'Dumbbell Glute Bridge', sets: 3, repRange: '15', description: 'High-rep glute bridge variation for additional glute volume and pump.' },
          { name: 'Goblet Squat', sets: 3, repRange: '12-15', description: 'Squat variation that reinforces full-depth mechanics while training glutes and quads.' },
          { name: 'Reverse Lunges', sets: 3, repRange: '10', description: 'Lower-body unilateral movement with a strong glute emphasis.' },
          { name: 'Frog Pumps', sets: 3, repRange: '25', description: 'High-rep glute finisher designed for metabolic stress and glute activation.' },
          { name: 'Banded Abductions', sets: 3, repRange: '20', description: 'Glute medius finisher for upper glute burn and hip stability.' },
          { name: 'Incline Walk or Stair Climber', sets: 1, repRange: '15-20 min', description: 'Conditioning finisher that reinforces glute and lower-body endurance.' },
        ],
      },
      {
        name: 'Rest',
        description: 'Recovery Day',
        sortOrder: 5,
        isRest: true,
        exercises: [],
      },
    ];

    for (const w of workouts) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [programId, w.name, w.description, w.isRest || false, w.sortOrder]
      );

      let sortOrder = 0;
      for (const ex of w.exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
            [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, sortOrder, ex.repRange, ex.description]
          );
        }
        sortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log('Seeded Glute Hypertrophy program');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedWillsPPL() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, $1, $2) RETURNING id",
      ["Will's PPL", "Will's custom Push, Pull, Legs split"]
    );
    const programId = program.id;

    const workouts = [
      {
        name: "Will's Legs 2",
        description: 'Quads, Hamstrings, Glutes, Calves',
        sortOrder: 1,
        exercises: [
          { name: 'Leg Extensions', sets: 3, repRange: '10-12', description: 'Quad isolation movement. Focus on controlled contraction at the top.' },
          { name: 'Leg Curls', sets: 3, repRange: '10-12', description: 'Hamstring isolation movement. Control the eccentric and squeeze at peak contraction.' },
          { name: 'Single Leg Leg Press', sets: 3, repRange: '10', description: 'Unilateral leg press for quad and glute development. One leg at a time to address imbalances.' },
          { name: 'BB Lunges', sets: 3, repRange: '10', description: 'Superset 1 of 3. Barbell lunges immediately into BB Squats and Calf Raises — no rest between exercises.' },
          { name: 'BB Squats', sets: 3, repRange: '10', description: 'Superset 2 of 3. Performed immediately after BB Lunges. Keep the same barbell loaded.' },
          { name: 'Calf Raises', sets: 3, repRange: '15', description: 'Superset 3 of 3. Performed immediately after BB Squats to finish the tri-set.' },
          { name: 'DB Walking Lunges', sets: 1, repRange: '20', description: 'Dumbbell walking lunges for distance/reps. Both legs, continuous movement.' },
          { name: 'DB Walking Lunges (Left)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — left leg only. Step with the left leg each rep.' },
          { name: 'DB Walking Lunges (Right)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — right leg only. Step with the right leg each rep.' },
          { name: 'Hip Abduction', sets: 2, repRange: '15', description: 'Machine hip abduction targeting the outer glutes and hip stabilizers.' },
          { name: 'Hip Adduction', sets: 2, repRange: '15', description: 'Machine hip adduction targeting the inner thighs.' },
        ],
      },
      {
        name: "Will's Pull 1",
        description: 'Back, Biceps, Rear Delts',
        sortOrder: 0,
        exercises: [
          { name: 'Cable Warm Up with Rope Attachment', sets: 3, repRange: '12-15', description: 'Superset: Face Pulls, Straight-Arm Pulldowns, Cable Rows, Hammer Curls' },
          { name: 'Single-Arm Cable Curls', sets: 1, repRange: '50', description: '50 total reps per arm.' },
          { name: 'Supinated Weighted Pull-Ups', sets: 3, repRange: '6', description: 'Underhand grip pull-ups with added weight. Focus on full range of motion and controlled reps.' },
          { name: 'Barbell Shrugs', sets: 3, repRange: '10-12', description: 'Superset with Hammer Curls. Heavy shrugs targeting upper traps — squeeze and hold at the top.' },
          { name: 'Hammer Curls', sets: 3, repRange: '10-12', description: 'Superset with Barbell Shrugs. Neutral grip curls targeting brachialis and forearms.' },
          { name: 'Banded Preacher Curls', sets: 3, repRange: '10-12', description: 'Resistance band preacher curls for constant tension through the full range of motion.' },
          { name: 'Wide-Grip Cable Pulldowns', sets: 3, repRange: '10-12', description: 'Wide grip lat pulldown emphasizing outer lats and upper back width.' },
          { name: 'Pyramid Single-Arm Cable Curls', sets: 7, repRange: '10', description: 'Pyramid sets: increase weight for 3 sets up to set 4 (peak), then decrease weight for the last 3 sets back down.' },
        ],
      },
    ];

    for (const w of workouts) {
      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
        [programId, w.name, w.description, w.sortOrder]
      );

      let sortOrder = 0;
      for (const ex of w.exercises) {
        for (let i = 0; i < ex.sets; i++) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
            [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, sortOrder, ex.repRange, ex.description]
          );
        }
        sortOrder++;
      }
    }

    await client.query('COMMIT');
    console.log("Seeded Will's PPL program");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedWillsLegs2(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current max sort_order for this program
    const { rows: [maxRow] } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM templates WHERE program_id = $1',
      [programId]
    );
    const sortOrder = maxRow.max_sort + 1;

    const exercises = [
      { name: 'Leg Extensions', sets: 3, repRange: '10-12', description: 'Quad isolation movement. Focus on controlled contraction at the top.' },
      { name: 'Leg Curls', sets: 3, repRange: '10-12', description: 'Hamstring isolation movement. Control the eccentric and squeeze at peak contraction.' },
      { name: 'Single Leg Leg Press', sets: 3, repRange: '10', description: 'Unilateral leg press for quad and glute development. One leg at a time to address imbalances.' },
      { name: 'BB Lunges', sets: 3, repRange: '10', description: 'Superset 1 of 3. Barbell lunges immediately into BB Squats and Calf Raises — no rest between exercises.' },
      { name: 'BB Squats', sets: 3, repRange: '10', description: 'Superset 2 of 3. Performed immediately after BB Lunges. Keep the same barbell loaded.' },
      { name: 'Calf Raises', sets: 3, repRange: '15', description: 'Superset 3 of 3. Performed immediately after BB Squats to finish the tri-set.' },
      { name: 'DB Walking Lunges', sets: 1, repRange: '20', description: 'Dumbbell walking lunges for distance/reps. Both legs, continuous movement.' },
      { name: 'DB Walking Lunges (Left)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — left leg only. Step with the left leg each rep.' },
      { name: 'DB Walking Lunges (Right)', sets: 1, repRange: '10', description: 'Single-leg dumbbell walking lunges — right leg only. Step with the right leg each rep.' },
      { name: 'Hip Abduction', sets: 2, repRange: '15', description: 'Machine hip abduction targeting the outer glutes and hip stabilizers.' },
      { name: 'Hip Adduction', sets: 2, repRange: '15', description: 'Machine hip adduction targeting the inner thighs.' },
    ];

    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
      [programId, "Will's Legs 2", 'Quads, Hamstrings, Glutes, Calves', sortOrder]
    );

    let exSort = 0;
    for (const ex of exercises) {
      for (let i = 0; i < ex.sets; i++) {
        await client.query(
          'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)',
          [tmpl.id, ex.name, i + 1, parseInt(ex.repRange) || 10, exSort, ex.repRange, ex.description]
        );
      }
      exSort++;
    }

    await client.query('COMMIT');
    console.log("Seeded Will's Legs 2 template");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedZJsWorkout() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, $1, $2) RETURNING id",
      ["ZJ's Workout", "ZJ's hypertrophy training program"]
    );
    const programId = program.id;

    const exercises = [
      { name: 'Cable Chest Flyes (Pre-Exhaust)', sets: [{ reps: 20, weight: 50 }, { reps: 8, weight: 45 }, { reps: 12, weight: 40 }, { reps: 16, weight: 35 }, { reps: 20, weight: 30 }], repRange: '8-20', description: 'Middle chest pre-exhaust. Set 1: 20 reps, Set 2: 16 reps, Set 3: 12 reps, Set 4: 8 reps, Set 5: 20 reps. 45 sec rest between sets. Choose a weight and increase each set.' },
      { name: 'Decline Barbell Bench Press', sets: [{ reps: 6, weight: 205 }, { reps: 6, weight: 205 }, { reps: 6, weight: 205 }, { reps: 6, weight: 205 }], repRange: '6-10', description: 'Primary lift. 3 sec down, controlled press up. Slight pause at the bottom to increase chest tension. 2 min rest.' },
      { name: 'Incline Dumbbell Press', sets: [{ reps: 12, weight: 100 }, { reps: 12, weight: 100 }, { reps: 12, weight: 100 }, { reps: 12, weight: 100 }], repRange: '8-12', description: 'Targets upper chest to balance the decline work. 90 sec rest.' },
      { name: 'Chest Dips (Lean Forward)', sets: [{ reps: 12, weight: 45 }, { reps: 10, weight: 45 }, { reps: 8, weight: 45 }], repRange: '8-12', description: 'Lean forward to emphasize chest. If bodyweight is easy, add weight with a belt. 90 sec rest. (1.5 reps) — Repeat the bottom half of the rep to accentuate the stretch.' },
      { name: 'Machine or Cable Chest Fly', sets: [{ reps: 15, weight: 50 }, { reps: 12, weight: 55 }, { reps: 12, weight: 60 }, { reps: 12, weight: 60 }], repRange: '12-15', description: 'Focus on slow stretch and squeeze. 60-75 sec rest.' },
      { name: 'Push-ups to Failure (Finisher)', sets: [{ reps: 99, weight: 0 }, { reps: 99, weight: 0 }], repRange: '999', description: 'Optional finisher. Go to failure each set.' },
    ];

    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, 0) RETURNING id',
      [programId, "ZJ's Chest Workout", 'Hypertrophy Chest Workout — Pre-exhaust cable flyes, decline bench, incline press, dips, flyes, burnout, finisher']
    );

    let sortOrder = 0;
    for (const ex of exercises) {
      for (let i = 0; i < ex.sets.length; i++) {
        await client.query(
          'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight, sortOrder, ex.repRange, ex.description]
        );
      }
      sortOrder++;
    }

    await client.query('COMMIT');
    console.log("Seeded ZJ's Workout program");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedWillsPush1(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [maxRow] } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM templates WHERE program_id = $1',
      [programId]
    );
    const sortOrder = maxRow.max_sort + 1;

    const exercises = [
      { name: 'Mid Upper Chest Flyes', sets: [{ reps: 20, weight: 30 }, { reps: 20, weight: 30 }, { reps: 20, weight: 30 }], repRange: '20', description: 'Cable or dumbbell flyes targeting the mid-upper chest. Focus on a deep stretch and controlled squeeze at the top.' },
      { name: 'Banded Close-Grip DB Bench', sets: [{ reps: 10, weight: 85 }, { reps: 10, weight: 85 }, { reps: 10, weight: 85 }], repRange: '10', description: 'Close-grip dumbbell bench press with a resistance band for added tension at lockout. Targets inner chest and triceps.' },
      { name: 'Incline DB Press', sets: [{ reps: 12, weight: 75 }, { reps: 12, weight: 75 }, { reps: 12, weight: 75 }], repRange: '12', description: 'Incline dumbbell press for upper chest development. Control the eccentric and drive through the chest.' },
      { name: 'Weighted Dips (Drop Set)', sets: [{ reps: 4, weight: 90 }, { reps: 4, weight: 45 }, { reps: 10, weight: 0 }], repRange: '4-10', description: 'Drop set dips: start heavy at 90 lbs, strip to 45 lbs, then bodyweight for 10 bottom-half reps. No rest between drops.' },
      { name: 'Cable Tricep Pushdowns (Pyramid)', sets: [{ reps: 12, weight: 40 }, { reps: 10, weight: 50 }, { reps: 8, weight: 60 }, { reps: 10, weight: 50 }, { reps: 12, weight: 40 }], repRange: '8-12', description: 'Pyramid sets: increase weight for 3 sets up to peak, then decrease back down. Focus on full extension and squeeze.' },
      { name: 'Cable Tricep Kickbacks (Burnout)', sets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 20 }, { reps: 15, weight: 20 }], repRange: '15', description: 'High-rep cable kickbacks for a tricep burnout. Keep upper arm locked and squeeze at full extension.' },
      { name: 'Hammer Strength Shoulder Press', sets: [{ reps: 10, weight: 90 }, { reps: 10, weight: 90 }, { reps: 10, weight: 90 }], repRange: '10', description: 'Machine shoulder press for controlled overhead pressing. Focus on full range of motion and even pressing.' },
      { name: 'Max Push-Ups', sets: [{ reps: 99, weight: 0 }, { reps: 99, weight: 0 }], repRange: 'Max', description: 'Finisher: go to failure on each set. Full range of motion, chest to floor.' },
    ];

    const { rows: [tmpl] } = await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
      [programId, "Will's Push 1", 'Chest, Triceps, Shoulders — flyes, bench, dips, pushdowns, shoulder press, burnout', sortOrder]
    );

    let exSort = 0;
    for (const ex of exercises) {
      for (let i = 0; i < ex.sets.length; i++) {
        await client.query(
          'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, rep_range, exercise_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight, exSort, ex.repRange, ex.description]
        );
      }
      exSort++;
    }

    await client.query('COMMIT');
    console.log("Seeded Will's Push 1 template");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function expandPPLto7Days(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First, reorder existing templates: Push=0, Pull=1, Legs=2
    await client.query(
      "UPDATE templates SET sort_order = 0 WHERE program_id = $1 AND name = $2",
      [programId, "Will's Push 1"]
    );
    await client.query(
      "UPDATE templates SET sort_order = 1 WHERE program_id = $1 AND name = $2",
      [programId, "Will's Pull 1"]
    );
    await client.query(
      "UPDATE templates SET sort_order = 2 WHERE program_id = $1 AND name = $2",
      [programId, "Will's Legs 2"]
    );

    // Duplicate Push, Pull, Legs as days 4-6 (sort_order 3-5)
    const originals = [
      { origName: "Will's Push 1", newName: "Will's Push 2", newSort: 3 },
      { origName: "Will's Pull 1", newName: "Will's Pull 2", newSort: 4 },
      { origName: "Will's Legs 2", newName: "Will's Legs 2b", newSort: 5 },
    ];

    for (const { origName, newName, newSort } of originals) {
      // Get original template
      const { rows: [orig] } = await client.query(
        "SELECT id, description FROM templates WHERE program_id = $1 AND name = $2",
        [programId, origName]
      );
      if (!orig) continue;

      // Create duplicate template
      const { rows: [newTmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
        [programId, newName, orig.description, newSort]
      );

      // Copy all exercises from original
      await client.query(
        `INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description)
         SELECT $1, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description
         FROM template_exercises WHERE template_id = $2`,
        [newTmpl.id, orig.id]
      );
    }

    // Add Rest Day as day 7 (sort_order 6)
    await client.query(
      'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, TRUE, $4)',
      [programId, "Rest Day", "Recovery day", 6]
    );

    await client.query('COMMIT');
    console.log("Expanded Will's PPL to 7-day cycle: Push, Pull, Legs, Push, Pull, Legs, Rest");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function expandBrowsePPLto6Weeks(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the base workout templates (Push, Pull, Legs — first 3 non-rest)
    const { rows: originals } = await client.query(
      "SELECT id, name, description FROM templates WHERE program_id = $1 AND is_rest = FALSE ORDER BY sort_order LIMIT 3",
      [programId]
    );

    // Get exercises for each base template
    const baseExercises = {};
    for (const orig of originals) {
      const { rows } = await client.query(
        'SELECT name, set_number, planned_reps, suggested_weight, sort_order FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, set_number',
        [orig.id]
      );
      baseExercises[orig.id] = rows;
    }

    // Delete all existing templates for this program (start fresh)
    await client.query('DELETE FROM templates WHERE program_id = $1', [programId]);

    // Generate 6 weeks: weight increases +5 lbs every 2 weeks
    for (let week = 1; week <= 6; week++) {
      const weightBonus = Math.floor((week - 1) / 2) * 5;
      const weekOffset = (week - 1) * 7;
      const weekLabel = week > 1 ? ` (Week ${week})` : '';

      // 6 workouts per week: Push, Pull, Legs, Push, Pull, Legs
      for (let dayIdx = 0; dayIdx < 6; dayIdx++) {
        const base = originals[dayIdx % 3];
        const sortOrder = weekOffset + dayIdx;
        const name = `${base.name}${weekLabel}`;

        const { rows: [newTmpl] } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, FALSE, $4) RETURNING id',
          [programId, name, base.description, sortOrder]
        );

        for (const ex of baseExercises[base.id]) {
          await client.query(
            'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
            [newTmpl.id, ex.name, ex.set_number, ex.planned_reps, ex.suggested_weight + weightBonus, ex.sort_order]
          );
        }
      }

      // Rest day at end of each week
      const restName = week > 1 ? `Rest (Week ${week})` : 'Rest';
      await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, TRUE, $4)',
        [programId, restName, 'Recovery Day', weekOffset + 6]
      );
    }

    await client.query('COMMIT');
    console.log('Expanded Browse PPL to 6-week program with progressive overload');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function expandPPLto4Weeks(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get all week 1 templates (sort_order 0-6)
    const { rows: week1Templates } = await client.query(
      "SELECT id, name, description, is_rest, sort_order FROM templates WHERE program_id = $1 AND sort_order <= 6 ORDER BY sort_order",
      [programId]
    );

    // Duplicate week 1 into weeks 2, 3, 4
    for (let week = 2; week <= 4; week++) {
      const offset = (week - 1) * 7;

      for (const tmpl of week1Templates) {
        const newName = tmpl.is_rest ? `Rest Day (Week ${week})` : `${tmpl.name} (Week ${week})`;
        const newSort = tmpl.sort_order + offset;

        const { rows: [newTmpl] } = await client.query(
          'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
          [programId, newName, tmpl.description, tmpl.is_rest, newSort]
        );

        // Copy exercises (skip for rest days)
        if (!tmpl.is_rest) {
          await client.query(
            `INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description)
             SELECT $1, name, set_number, planned_reps, suggested_weight, sort_order, set_type, rep_range, exercise_description
             FROM template_exercises WHERE template_id = $2`,
            [newTmpl.id, tmpl.id]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log("Expanded Will's PPL to 4-week (28-day) program");
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const MENTZER_CYCLE = [
      {
        name: 'Chest & Back',
        description: 'Incline Press, Pull-Ups, Dips, Deadlifts — 1 working set to failure',
        isRest: false,
        exercises: [
          { name: 'Incline Barbell Press (warm-up 50%)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Incline Barbell Press (warm-up 70%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Incline Barbell Press', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Pull-Ups (warm-up)', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Pull-Ups', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Weighted Dips (warm-up)', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Weighted Dips', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Deadlifts (warm-up 50%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Deadlifts (warm-up 70%)', sets: [{ reps: 3, weight: 0 }] },
          { name: 'Deadlifts', sets: [{ reps: 6, weight: 0 }] },
        ],
      },
      {
        name: 'Legs',
        description: 'Leg Extensions, Leg Press, Squats, Calf Raises — 1 working set to failure',
        isRest: false,
        exercises: [
          { name: 'Leg Extensions (warm-up)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Leg Extensions', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Leg Press (warm-up 50%)', sets: [{ reps: 8, weight: 0 }] },
          { name: 'Leg Press (warm-up 70%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Leg Press', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Squats (warm-up 50%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Squats (warm-up 70%)', sets: [{ reps: 3, weight: 0 }] },
          { name: 'Squats', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Standing Calf Raises (warm-up)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Standing Calf Raises', sets: [{ reps: 12, weight: 0 }, { reps: 10, weight: 0 }] },
        ],
      },
      {
        name: 'Shoulders & Arms',
        description: 'Curls, Shoulder Press, Lateral Raises, Close-Grip Bench, Pushdowns — 1 working set to failure',
        isRest: false,
        exercises: [
          { name: 'Barbell Curl (warm-up)', sets: [{ reps: 8, weight: 0 }] },
          { name: 'Barbell Curl', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Shoulder Press (warm-up 50%)', sets: [{ reps: 8, weight: 0 }] },
          { name: 'Shoulder Press (warm-up 70%)', sets: [{ reps: 5, weight: 0 }] },
          { name: 'Shoulder Press', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Lateral Raises (warm-up)', sets: [{ reps: 10, weight: 0 }] },
          { name: 'Lateral Raises', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Close-Grip Bench Press (warm-up 50%)', sets: [{ reps: 6, weight: 0 }] },
          { name: 'Close-Grip Bench Press', sets: [{ reps: 7, weight: 0 }] },
          { name: 'Triceps Pushdown (warm-up)', sets: [{ reps: 9, weight: 0 }] },
          { name: 'Triceps Pushdown', sets: [{ reps: 8, weight: 0 }] },
        ],
      },
      {
        name: 'Rest',
        description: 'Recovery Day',
        isRest: true,
        exercises: [],
      },
    ];

async function seedMikeMentzerTemplates(programId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Repeat the 4-day cycle 7 times for 28 days (4 weeks)
    for (let day = 0; day < 28; day++) {
      const base = MENTZER_CYCLE[day % 4];
      const week = Math.floor(day / 7) + 1;
      const name = week > 1 ? `${base.name} (Week ${week})` : base.name;

      const { rows: [tmpl] } = await client.query(
        'INSERT INTO templates (user_id, program_id, name, description, is_rest, sort_order) VALUES (NULL, $1, $2, $3, $4, $5) RETURNING id',
        [programId, name, base.description, base.isRest, day]
      );

      if (base.exercises.length > 0) {
        let exSortOrder = 0;
        for (const ex of base.exercises) {
          for (let i = 0; i < ex.sets.length; i++) {
            await client.query(
              'INSERT INTO template_exercises (template_id, name, set_number, planned_reps, suggested_weight, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
              [tmpl.id, ex.name, i + 1, ex.sets[i].reps, ex.sets[i].weight, exSortOrder]
            );
          }
          exSortOrder++;
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function seedMikeMentzer() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [program] } = await client.query(
      "INSERT INTO programs (user_id, name, description) VALUES (NULL, $1, $2) RETURNING id",
      ['Mike Mentzer Workout', '4-week Heavy Duty program — 4-day cycle with 1 working set to failure']
    );
    await client.query('COMMIT');
    await seedMikeMentzerTemplates(program.id);
    console.log('Seeded Mike Mentzer Workout program');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
