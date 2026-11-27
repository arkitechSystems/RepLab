// When each workout (template) was made (2026-11-27). The My Workouts page
// groups the user's workouts by the month they were created, newest first.
//
// - Adds templates.created_at (nullable). Every template inserted from now on
//   gets now() from the column default — including copies (program builder,
//   sharing, Save to My Workouts, duplicate week), which count as new.
// - Existing rows are left NULL by the ADD COLUMN (the default is set
//   afterwards, so it doesn't stamp them with the deploy time), then the
//   user's own workouts are backfilled with the time of their earliest
//   session (sessions.created_at; the session's date when that is missing).
//   Workouts never started stay NULL — the page shows them under "Earlier".
//   Library workouts (user_id NULL) are not backfilled.

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`);
  pgm.sql(`ALTER TABLE templates ALTER COLUMN created_at SET DEFAULT now()`);
  pgm.sql(`
    UPDATE templates t
       SET created_at = s.first_at
      FROM (
        SELECT template_id, user_id,
               COALESCE(
                 MIN(created_at),
                 MIN(CASE WHEN date ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN date::date END)::timestamptz
               ) AS first_at
          FROM sessions
         WHERE template_id IS NOT NULL
         GROUP BY template_id, user_id
      ) s
     WHERE t.id = s.template_id
       AND t.user_id = s.user_id
       AND t.created_at IS NULL
       AND s.first_at IS NOT NULL
  `);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE templates DROP COLUMN IF EXISTS created_at`);
};
