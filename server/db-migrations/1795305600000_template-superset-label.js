// Superset labels on saved workouts (2026-11-22). A session's workout_data
// already keeps `supersetLabel` (A1, A2…); templates had nowhere to keep it,
// so a workout built on the session screen ("Create a Workout") lost its
// supersets when saved. Sessions copied from a template now start with it.
// See docs/trainer-workout-template.md (the importer reads the same field).

export const up = (pgm) => {
  pgm.sql(`ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS superset_label TEXT`);
};

export const down = (pgm) => {
  pgm.sql(`ALTER TABLE template_exercises DROP COLUMN IF EXISTS superset_label`);
};
