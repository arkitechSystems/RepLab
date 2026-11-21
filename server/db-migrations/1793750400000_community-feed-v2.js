// Community feed v2 (2026-11): program completions + workout-streak
// milestones. These tables were first created by initDb.js on `main` before
// node-pg-migrate was merged, so production already has them — IF NOT EXISTS
// makes this a no-op there and builds them on a brand-new database.
//
// The one-time sharing-settings move that goes with this feature is data, not
// structure, so it stays in initDb.js (migrateCommunitySettingsV2).

export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS program_completions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      program_start_id INT NOT NULL UNIQUE REFERENCES program_starts(id) ON DELETE CASCADE,
      program_id INT REFERENCES programs(id) ON DELETE SET NULL,
      program_name TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_program_completions_completed ON program_completions(completed_at);

    CREATE TABLE IF NOT EXISTS streak_milestones (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      milestone INT NOT NULL,
      run_start DATE NOT NULL,
      reached_on DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, milestone, reached_on)
    );
    CREATE INDEX IF NOT EXISTS idx_streak_milestones_created ON streak_milestones(created_at);
    CREATE INDEX IF NOT EXISTS idx_streak_milestones_user ON streak_milestones(user_id, reached_on);
  `);
}

export function down(pgm) {
  pgm.sql(`
    DROP TABLE IF EXISTS streak_milestones;
    DROP TABLE IF EXISTS program_completions;
  `);
}
