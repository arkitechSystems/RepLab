// Adds users.account_id — a public 5-digit identifier separate from the
// internal SERIAL `id`. We don't touch `id` because it's referenced by
// dozens of foreign keys; instead, the profile card now surfaces account_id
// (which users see) while the DB continues to key off id (unchanged).
//
// Assignments on first run:
//   - Wmartin23            → 23231
//   - Everyone else        → 23232, 23233, … (ordered by created_at)
//   - Future signups       → nextval('users_account_id_seq'), auto-applied
//     via DEFAULT on the column
//
// Idempotent: safe to re-run. Existing account_id values are preserved.
//
// Run with: node --env-file=server/.env server/migrations/add-account-ids-starting-at-23231.js

import pool from '../dbPool.js';

const ANCHOR_USERNAME = 'Wmartin23';
const ANCHOR_ID = 23231;

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Column + sequence
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id INT UNIQUE');
    await client.query('CREATE SEQUENCE IF NOT EXISTS users_account_id_seq');

    // 2. Anchor: set Wmartin23 to 23231 (only if they don't already have one).
    const { rowCount: anchorSet } = await client.query(
      `UPDATE users SET account_id = $1
       WHERE username = $2 AND account_id IS NULL`,
      [ANCHOR_ID, ANCHOR_USERNAME]
    );
    if (anchorSet) console.log(`  ${ANCHOR_USERNAME} → ${ANCHOR_ID}`);

    // 3. Backfill remaining users ordered by created_at. Start numbering at
    //    23232 so the anchor value is never reused, even if Wmartin23 wasn't
    //    present (anchor = 23231 stays reserved).
    const { rows: backfilled } = await client.query(
      `WITH ranked AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
         FROM users WHERE account_id IS NULL
       )
       UPDATE users u
       SET account_id = $1 + ranked.rn
       FROM ranked
       WHERE u.id = ranked.id
       RETURNING u.username, u.account_id`,
      [ANCHOR_ID]
    );
    backfilled.forEach((u) => console.log(`  ${u.username || '(no username)'} → ${u.account_id}`));

    // 4. Bump sequence past the highest assigned value so future signups
    //    continue from there (not from 23231).
    await client.query(
      `SELECT setval('users_account_id_seq',
        GREATEST($1::bigint, COALESCE((SELECT MAX(account_id) FROM users), $1::bigint)))`,
      [ANCHOR_ID]
    );

    // 5. Default for future inserts.
    await client.query(
      `ALTER TABLE users ALTER COLUMN account_id SET DEFAULT nextval('users_account_id_seq')`
    );

    await client.query('COMMIT');
    console.log('Done.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
