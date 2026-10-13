# Database migrations (node-pg-migrate)

Every change to the database structure (tables, columns, indexes, constraints)
is a numbered file here. On every start the server runs the ones the database
hasn't had yet, in order, each in a transaction, and records them in the
`pgmigrations` table (`server/migrate.js`, called from `initDb.js`).

- `1791849600000_baseline.js` builds the whole database as it was on
  2026-10-13 (`baseline/schema.sql`, taken from production). On an existing
  database it does nothing but get recorded.
- Seed data and one-time data fixes are not migrations — they stay in
  `initDb.js` and must be safe to run on every start.

## Adding a change

1. From `server/`: `npm run migrate:create -- add-user-nickname`
   (creates `db-migrations/<timestamp>_add-user-nickname.js`).
2. Write `up` (and `down` to undo it, when that's possible):

   ```js
   export const up = (pgm) => {
     pgm.sql(`ALTER TABLE users ADD COLUMN nickname TEXT`);
   };
   export const down = (pgm) => {
     pgm.sql(`ALTER TABLE users DROP COLUMN nickname`);
   };
   ```

3. Start the server locally (or run the tests against the test database) — the
   migration runs once and is recorded.
4. Never edit or rename a migration after it has been deployed; add a new one.
   The server refuses to start if the recorded order doesn't match the files.

Notes:
- New tables or columns that hold user data must also be handled in
  `db.deleteUser` and `server/tests/cascade-delete.test.js` (account deletion).
- Workout / exercise / program fields must stay in sync with the trainer
  template — see `docs/trainer-workout-template.md`.
- pg-boss keeps its own tables in the `pgboss` schema; migrations here only
  touch `public`.
- Undo the most recent migration locally: `npm run migrate:down`.
