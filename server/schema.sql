CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  gender TEXT,
  username TEXT UNIQUE,
  role TEXT DEFAULT 'client',
  referral_source TEXT,
  referral_code TEXT,
  plan TEXT DEFAULT 'Free',
  trial_end TIMESTAMPTZ,
  signup_device TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  zip_code TEXT,
  signup_city TEXT,
  signup_state TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT email_or_phone CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  cardio_acceleration_enabled BOOLEAN DEFAULT FALSE,
  program_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  program_id INT REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_rest BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0,
  phase TEXT
);

CREATE TABLE IF NOT EXISTS template_exercises (
  id SERIAL PRIMARY KEY,
  template_id INT REFERENCES templates(id) ON DELETE CASCADE,
  -- exercise_id is the canonical link into the master library. NULL is
  -- allowed for legacy rows that haven't been backfilled yet and for
  -- section-header rows (is_section_header = TRUE) where `name` is a
  -- label, not an exercise. New code should write exercise_id alongside
  -- name; old read paths still join via LOWER(name) until the refactor
  -- to id-keyed reads lands.
  exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  set_type TEXT DEFAULT 'straight',
  set_number INT NOT NULL,
  planned_reps INT DEFAULT 10,
  suggested_weight NUMERIC DEFAULT 0,
  sort_order INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise_id ON template_exercises(exercise_id);

CREATE TABLE IF NOT EXISTS schedule_days (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  day_of_week INT,
  template_id INT REFERENCES templates(id) ON DELETE CASCADE,
  schedule_date DATE
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  template_id INT REFERENCES templates(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  notes JSONB DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  workout_data JSONB,
  last_activity_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_entries (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  -- See template_exercises.exercise_id note: canonical id link, kept
  -- alongside exercise_name during the dual-write transition.
  exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  set_number INT NOT NULL,
  weight NUMERIC DEFAULT 0,
  reps INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_session_entries_exercise_id ON session_entries(exercise_id);

CREATE TABLE IF NOT EXISTS personal_bests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  template_id INT REFERENCES templates(id) ON DELETE CASCADE,
  -- See template_exercises.exercise_id note: canonical id link, kept
  -- alongside exercise_name during the dual-write transition.
  exercise_id INT REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  best_weight NUMERIC NOT NULL,
  best_reps INT NOT NULL,
  achieved_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_personal_bests_exercise_id ON personal_bests(exercise_id);

-- Feed reactions — one row per (user, item). Switching a reaction is an
-- UPDATE; clearing it is a DELETE. item_id is a string key shared with the
-- client (see normalizeUrl + prefix scheme in RepLabFeedTest.jsx).
CREATE TABLE IF NOT EXISTS feed_reactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_item ON feed_reactions(item_id);

CREATE TABLE IF NOT EXISTS user_metrics (
  user_id INT PRIMARY KEY REFERENCES users(id),
  height NUMERIC,
  weight NUMERIC,
  body_fat NUMERIC,
  max_bench NUMERIC,
  max_squat NUMERIC,
  max_deadlift NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  model TEXT,
  cost_cents NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT FALSE,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_custom BOOLEAN DEFAULT FALSE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Master library uniqueness guard. No two master rows (created_by IS NULL)
-- may share the same name, case-insensitive. Customs are exempt — each user
-- can hold their own private custom with any name, including names that
-- collide with another user's customs or with a master row (the master
-- always wins on resolution). This is the safety net that prevents the
-- Path A 2026-05-17 cleanup from ever needing to happen again.
CREATE UNIQUE INDEX IF NOT EXISTS exercises_master_name_unique
  ON exercises (LOWER(name))
  WHERE created_by IS NULL;

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  source TEXT NOT NULL DEFAULT 'stripe',
  plan TEXT NOT NULL,
  billing_interval TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trainer_clients (
  id SERIAL PRIMARY KEY,
  trainer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trainer_id, client_id)
);

CREATE TABLE IF NOT EXISTS trainer_applications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS page_visits (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_login_history (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  city TEXT,
  state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL UNIQUE,
  platform TEXT DEFAULT 'ios',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_programs (
  id SERIAL PRIMARY KEY,
  source_program_id INT REFERENCES programs(id) ON DELETE SET NULL,
  sender_id INT NOT NULL REFERENCES users(id),
  recipient_id INT NOT NULL REFERENCES users(id),
  copied_program_id INT REFERENCES programs(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Display-only short names for library programs. Lookup table keyed on the
-- exact program name; if a program has no row here it falls back to its full
-- name. Used everywhere except the program list cards (which keep the full
-- name for browse-time clarity).
CREATE TABLE IF NOT EXISTS program_name_abbreviations (
  full_name TEXT PRIMARY KEY,
  short_name TEXT NOT NULL
);

-- Trainer dashboard session tokens. Stored hashed (token_hash) so a leaked
-- DB row can't be replayed; the raw token only lives in the user's cookie.
-- DB-backed (rather than in-memory) so server restarts don't log everyone out.
CREATE TABLE IF NOT EXISTS trainer_sessions (
  id SERIAL PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trainer_sessions_token ON trainer_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_trainer_sessions_expires ON trainer_sessions(expires_at);

-- Audit trail for password reset requests. One row per request; used_at is
-- populated when the token is consumed. Lets us trace abuse patterns and
-- detect tokens that were generated but never used (probe vs real reset).
CREATE TABLE IF NOT EXISTS password_reset_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  request_ip TEXT,
  use_ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_password_reset_log_user ON password_reset_log(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_log_token ON password_reset_log(token_hash);

-- Account deletion confirmation tokens (web-based deletion flow). Required by
-- Google Play's 2024 account-deletion policy: users without the app installed
-- must be able to delete their account from a public web page. The user enters
-- their email at /delete-account, we email them a confirmation link with a
-- single-use token, and GET /auth/confirm-deletion?token=... performs the same
-- cascade as the in-app delete. Mirrors password_reset_log shape so the token
-- hash + audit fields stay consistent across both flows.
CREATE TABLE IF NOT EXISTS account_deletion_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  request_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_account_deletion_tokens_user ON account_deletion_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_account_deletion_tokens_hash ON account_deletion_tokens(token_hash);

-- Cardio entries logged inside (or outside) a workout session. session_id is
-- nullable so users can log standalone cardio. Common fields are columns;
-- per-machine specifics (speed, incline, resistance, level, pace, stroke
-- rate, rpm) live in metadata JSONB so the schema doesn't need a column per
-- machine type.
CREATE TABLE IF NOT EXISTS cardio_entries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INT REFERENCES sessions(id) ON DELETE CASCADE,
  cardio_type TEXT NOT NULL,
  duration_secs INT NOT NULL,
  distance_m NUMERIC,
  calories INT,
  avg_heart_rate INT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cardio_entries_user_session ON cardio_entries(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_cardio_entries_user_type ON cardio_entries(user_id, cardio_type);

-- Pre-launch interest list for REPLAB Pro. Anyone can submit an email; if it
-- matches an existing user we link via user_id so the admin view can show the
-- account's plan. Emails are unique so re-submitting from the same address
-- updates the existing row instead of creating duplicates.
CREATE TABLE IF NOT EXISTS pro_waiting_list (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'email',  -- 'email' | 'logged_in'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pro_waiting_list_user ON pro_waiting_list(user_id);
