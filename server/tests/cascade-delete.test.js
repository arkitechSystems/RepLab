// Integration test for db.deleteUser cascade behavior.
//
// Apple App Store guideline 5.1.1(v) requires that account deletion leaves
// NO orphaned data. This test creates a user, populates every dependent
// table, then deletes the user and asserts zero rows remain anywhere.
//
// If a future schema change adds a new table referencing users.id but
// forgets to add ON DELETE CASCADE or update db.deleteUser, this test
// fails — exactly the regression we want to catch.
//
// REQUIREMENTS:
//   - Needs a real PostgreSQL connection (DATABASE_URL).
//   - The test self-skips with describe.skip when DATABASE_URL is unset
//     so CI without a DB doesn't break.
//   - Cleans up its own data (via db.deleteUser, by design) and a final
//     defensive sweep in afterAll for any partial-failure leftovers.
//
// Unlike server/tests/api.test.js (which mocks db.js + dbPool), this file
// must NOT mock either — the whole point is to exercise the real SQL.
// Vitest discovers each *.test.js file in its own worker, so the mocks in
// api.test.js do not leak into this file.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// JWT_SECRET only needed if we end up importing modules that bootstrap
// auth middleware. Set it defensively so any transitive import doesn't
// blow up.
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-key-at-least-thirty-two-chars-long';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const HAS_DB = !!process.env.DATABASE_URL;

// Tables we expect to be empty for the deleted user, keyed by the column
// that holds the user FK. Each entry is [tableName, fkColumn]. For tables
// that hold the user via TWO columns (e.g. shared_programs has sender_id
// AND recipient_id; trainer_clients has trainer_id AND client_id) we add
// a row per column so both directions get checked.
//
// This list is the source of truth — adding a new dependent table to the
// schema means adding it here too. The test uses information_schema at
// runtime to flag any FK-to-users.id table that's NOT in this list, which
// is the regression catcher.
const DEPENDENT_TABLES = [
  ['programs', 'user_id'],
  ['templates', 'user_id'],
  ['schedule_days', 'user_id'],
  ['sessions', 'user_id'],
  ['personal_bests', 'user_id'],
  ['feed_reactions', 'user_id'],
  ['user_metrics', 'user_id'],
  ['ai_usage', 'user_id'],
  ['feedback', 'user_id'],
  ['subscriptions', 'user_id'],
  ['trainer_clients', 'trainer_id'],
  ['trainer_clients', 'client_id'],
  ['trainer_applications', 'user_id'],
  ['page_visits', 'user_id'],
  ['user_login_history', 'user_id'],
  ['device_tokens', 'user_id'],
  ['shared_programs', 'sender_id'],
  ['shared_programs', 'recipient_id'],
  ['trainer_sessions', 'user_id'],
  ['password_reset_log', 'user_id'],
  ['trainer_login_history', 'user_id'],
  ['challenge_entries', 'user_id'],
  ['cardio_entries', 'user_id'],
  ['account_deletion_tokens', 'user_id'],
];

// Tables whose rows are NOT deleted but where the FK column is set to NULL
// (per privacy-audit policy: preserve the row, sever the linkage).
// - exercises.created_by: custom exercises authored by the user stay in the
//   library (other users may have copied them into templates) with the
//   created_by reference cleared.
// - pro_waiting_list.user_id: the pre-launch interest list is keyed on email
//   (UNIQUE), not the user FK. Deleting the user nulls the link so the email
//   row survives as a standalone waitlist entry. This matches the FK's
//   ON DELETE SET NULL.
const PRESERVE_BUT_NULL = [
  ['exercises', 'created_by'],
  ['pro_waiting_list', 'user_id'],
];

const describeIfDb = HAS_DB ? describe : describe.skip;

describeIfDb('db.deleteUser cascade (integration)', () => {
  let pool;
  let db;
  let testUserId;
  // Track auxiliary rows we created so we can clean them up if the test
  // fails before the deleteUser step (e.g. a recipient user for the
  // shared_programs row).
  const auxUserIds = [];
  // Preserve-but-NULL rows survive deleteUser by design (privacy policy:
  // keep row, sever linkage). They have no user FK left after the test, so
  // afterAll has to remove them explicitly or each run leaves debris.
  // Map of table → array of row ids to delete on teardown.
  const preserveButNullRowsToCleanup = { exercises: [], pro_waiting_list: [] };

  beforeAll(async () => {
    // Import lazily — dbPool.js opens a connection at module load.
    const poolMod = await import('../dbPool.js');
    const dbMod = await import('../db.js');
    pool = poolMod.default;
    db = dbMod.default;

    // Make sure the schema exists. initDb is idempotent (CREATE TABLE IF
    // NOT EXISTS, ALTER ... IF NOT EXISTS) so it's safe to call against
    // a partially-migrated DB.
    const initDbMod = await import('../initDb.js');
    await initDbMod.default();
  }, 60_000);

  afterAll(async () => {
    // Defensive cleanup: if the test bailed before deleteUser ran, sweep
    // anything we may have left behind. deleteUser is the canonical path,
    // so call it on every aux user too — it's idempotent (DELETE WHERE
    // id = $1 is fine on a missing row).
    try {
      if (testUserId) {
        await db.deleteUser(testUserId).catch(() => {});
      }
      for (const id of auxUserIds) {
        await db.deleteUser(id).catch(() => {});
      }
      for (const [table, ids] of Object.entries(preserveButNullRowsToCleanup)) {
        for (const id of ids) {
          await pool
            .query(`DELETE FROM ${table} WHERE id = $1`, [id])
            .catch(() => {});
        }
      }
    } finally {
      // Don't end the pool — vitest may run other files in the same
      // worker, and ending the pool here would break them.
    }
  }, 60_000);

  it('removes all rows tied to the user across every dependent table', async () => {
    // -- 1. Create the test user via direct SQL so we don't depend on the
    //       auth flow (signup has rate limits, geo lookups, etc).
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `cascade-test-${uniqueSuffix}@example.com`;
    const username = `cascadetest${uniqueSuffix}`.slice(0, 40);

    const { rows: userRows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, username, role)
       VALUES ($1, 'fake-hash', 'Cascade', 'Test', $2, 'client')
       RETURNING id`,
      [email, username]
    );
    testUserId = userRows[0].id;

    // A second user — needed as a counterparty for trainer_clients and
    // shared_programs (both have NOT NULL FKs that can't both point to
    // the same user in trainer_clients due to its UNIQUE constraint).
    const peerEmail = `cascade-peer-${uniqueSuffix}@example.com`;
    const peerUsername = `cascadepeer${uniqueSuffix}`.slice(0, 40);
    const { rows: peerRows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, username, role)
       VALUES ($1, 'fake-hash', 'Cascade', 'Peer', $2, 'client')
       RETURNING id`,
      [peerEmail, peerUsername]
    );
    const peerUserId = peerRows[0].id;
    auxUserIds.push(peerUserId);

    // -- 2. Populate every dependent table for testUserId.
    //       Use raw SQL (no db.js helper for some) to keep the setup
    //       self-contained and obvious.

    // programs
    const { rows: progRows } = await pool.query(
      `INSERT INTO programs (user_id, name) VALUES ($1, 'Cascade Program') RETURNING id`,
      [testUserId]
    );
    const programId = progRows[0].id;

    // templates
    const { rows: tmplRows } = await pool.query(
      `INSERT INTO templates (user_id, program_id, name) VALUES ($1, $2, 'Cascade Template') RETURNING id`,
      [testUserId, programId]
    );
    const templateId = tmplRows[0].id;

    // template_exercises (cascade-via-templates, not directly user-owned)
    await pool.query(
      `INSERT INTO template_exercises (template_id, name, set_number) VALUES ($1, 'Squat', 1)`,
      [templateId]
    );

    // schedule_days
    await pool.query(
      `INSERT INTO schedule_days (user_id, template_id, schedule_date)
       VALUES ($1, $2, '2026-05-01')`,
      [testUserId, templateId]
    );

    // sessions
    const { rows: sessRows } = await pool.query(
      `INSERT INTO sessions (user_id, template_id, date) VALUES ($1, $2, '2026-05-01') RETURNING id`,
      [testUserId, templateId]
    );
    const sessionId = sessRows[0].id;

    // session_entries (cascade-via-sessions)
    await pool.query(
      `INSERT INTO session_entries (session_id, exercise_name, set_number, weight, reps)
       VALUES ($1, 'Squat', 1, 225, 5)`,
      [sessionId]
    );

    // personal_bests
    await pool.query(
      `INSERT INTO personal_bests (user_id, template_id, exercise_name, best_weight, best_reps)
       VALUES ($1, $2, 'Squat', 225, 5)`,
      [testUserId, templateId]
    );

    // feed_reactions
    await pool.query(
      `INSERT INTO feed_reactions (user_id, item_id, reaction)
       VALUES ($1, 'cascade-item', 'like')`,
      [testUserId]
    );

    // user_metrics
    await pool.query(
      `INSERT INTO user_metrics (user_id, weight) VALUES ($1, 180)`,
      [testUserId]
    );

    // ai_usage
    await pool.query(
      `INSERT INTO ai_usage (user_id, input_tokens, output_tokens, model, cost_cents)
       VALUES ($1, 10, 20, 'claude-sonnet', 1)`,
      [testUserId]
    );

    // feedback
    await pool.query(
      `INSERT INTO feedback (user_id, type, message) VALUES ($1, 'bug', 'cascade test')`,
      [testUserId]
    );

    // subscriptions
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, billing_interval, source, stripe_subscription_id)
       VALUES ($1, 'Pro', 'monthly', 'stripe', $2)`,
      [testUserId, `sub_cascade_${uniqueSuffix}`]
    );

    // trainer_clients — testUser as both trainer (paired with peer client)
    // and client (paired with peer trainer). Two rows so the FK column
    // assertions for trainer_id AND client_id both have something to find.
    await pool.query(
      `INSERT INTO trainer_clients (trainer_id, client_id) VALUES ($1, $2)`,
      [testUserId, peerUserId]
    );
    await pool.query(
      `INSERT INTO trainer_clients (trainer_id, client_id) VALUES ($1, $2)`,
      [peerUserId, testUserId]
    );

    // trainer_applications
    await pool.query(
      `INSERT INTO trainer_applications (user_id, message, status)
       VALUES ($1, 'apply please', 'pending')`,
      [testUserId]
    );

    // page_visits
    await pool.query(
      `INSERT INTO page_visits (user_id, path) VALUES ($1, '/dashboard')`,
      [testUserId]
    );

    // user_login_history
    await pool.query(
      `INSERT INTO user_login_history (user_id, email, ip) VALUES ($1, $2, '127.0.0.1')`,
      [testUserId, email]
    );

    // device_tokens
    await pool.query(
      `INSERT INTO device_tokens (user_id, push_token, platform)
       VALUES ($1, $2, 'ios')`,
      [testUserId, `cascade-token-${uniqueSuffix}`]
    );

    // shared_programs — both directions (testUser as sender AND recipient)
    await pool.query(
      `INSERT INTO shared_programs (source_program_id, sender_id, recipient_id)
       VALUES ($1, $2, $3)`,
      [programId, testUserId, peerUserId]
    );
    await pool.query(
      `INSERT INTO shared_programs (sender_id, recipient_id) VALUES ($1, $2)`,
      [peerUserId, testUserId]
    );

    // trainer_sessions
    await pool.query(
      `INSERT INTO trainer_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
      [`cascade-token-hash-${uniqueSuffix}`, testUserId]
    );

    // password_reset_log
    await pool.query(
      `INSERT INTO password_reset_log (user_id, token_hash, request_ip)
       VALUES ($1, $2, '127.0.0.1')`,
      [testUserId, `cascade-reset-hash-${uniqueSuffix}`]
    );

    // trainer_login_history
    await pool.query(
      `INSERT INTO trainer_login_history (user_id, email, ip) VALUES ($1, $2, '127.0.0.1')`,
      [testUserId, email]
    );

    // challenge_entries
    await pool.query(
      `INSERT INTO challenge_entries (user_id, challenge, value)
       VALUES ($1, 'pushup-april', 50)`,
      [testUserId]
    );

    // cardio_entries — both standalone and session-linked. CASCADEd via the
    // user_id FK, so it should disappear after deletion.
    await pool.query(
      `INSERT INTO cardio_entries (user_id, session_id, cardio_type, duration_secs, distance_m, calories)
       VALUES ($1, $2, 'treadmill', 600, 1500, 80)`,
      [testUserId, sessionId]
    );
    await pool.query(
      `INSERT INTO cardio_entries (user_id, cardio_type, duration_secs)
       VALUES ($1, 'rower', 1200)`,
      [testUserId]
    );

    // account_deletion_tokens — email-confirm tokens for the public delete
    // flow (Google Play 2024 requirement). CASCADEd via user_id FK so the
    // row disappears with the user. Hash is a placeholder; the test only
    // checks row existence pre-delete and absence post-delete.
    await pool.query(
      `INSERT INTO account_deletion_tokens (user_id, token_hash, expires_at, request_ip)
       VALUES ($1, 'placeholder-hash-for-cascade-test', NOW() + INTERVAL '1 hour', '127.0.0.1')`,
      [testUserId]
    );

    // exercises (created_by) — preserved-but-NULLed, not deleted
    const { rows: exRows } = await pool.query(
      `INSERT INTO exercises (name, muscle_group, is_custom, created_by)
       VALUES ($1, 'chest', TRUE, $2) RETURNING id`,
      [`Cascade Custom Exercise ${uniqueSuffix}`, testUserId]
    );
    const customExerciseId = exRows[0].id;
    preserveButNullRowsToCleanup.exercises.push(customExerciseId);

    // pro_waiting_list — preserved-but-NULLed. The email row survives as a
    // standalone waitlist entry; only the user_id link is cleared.
    const waitlistEmail = `cascade-waitlist-${uniqueSuffix}@example.com`;
    const { rows: waitRows } = await pool.query(
      `INSERT INTO pro_waiting_list (email, user_id, source)
       VALUES ($1, $2, 'logged_in') RETURNING id`,
      [waitlistEmail, testUserId]
    );
    const waitlistRowId = waitRows[0].id;
    preserveButNullRowsToCleanup.pro_waiting_list.push(waitlistRowId);

    // -- 3. Sanity check: confirm setup populated every table.
    for (const [table, col] of DEPENDENT_TABLES) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM ${table} WHERE ${col} = $1`,
        [testUserId]
      );
      expect(
        rowCount,
        `setup precondition: ${table}.${col} should have at least one row for testUserId before deletion`
      ).toBeGreaterThan(0);
    }

    // -- 4. Trigger deletion via the canonical path.
    await db.deleteUser(testUserId);

    // -- 5. Assert zero rows remain in every dependent table.
    const orphans = [];
    for (const [table, col] of DEPENDENT_TABLES) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM ${table} WHERE ${col} = $1`,
        [testUserId]
      );
      if (rowCount > 0) {
        orphans.push(`${table}.${col} (${rowCount} row${rowCount === 1 ? '' : 's'})`);
      }
    }
    expect(
      orphans,
      `App Store 5.1.1(v): orphaned rows after account deletion: ${orphans.join(', ')}`
    ).toEqual([]);

    // -- 6. The user row itself is gone.
    const { rowCount: userLeft } = await pool.query(
      `SELECT 1 FROM users WHERE id = $1`,
      [testUserId]
    );
    expect(userLeft, 'user row should be deleted').toBe(0);

    // -- 7. Preserve-but-NULL: the row must still exist, FK column NULL.
    //       Each preserved table tracks its own seeded row id (per-table
    //       lookup — exercises uses customExerciseId, pro_waiting_list uses
    //       waitlistRowId, etc).
    const preservedRowIds = {
      exercises: customExerciseId,
      pro_waiting_list: waitlistRowId,
    };
    for (const [table, col] of PRESERVE_BUT_NULL) {
      const rowId = preservedRowIds[table];
      expect(
        rowId,
        `test bug: PRESERVE_BUT_NULL includes ${table} but no seeded row id is tracked in preservedRowIds`
      ).toBeDefined();
      const { rows: preserved } = await pool.query(
        `SELECT ${col} FROM ${table} WHERE id = $1`,
        [rowId]
      );
      expect(
        preserved.length,
        `${table} row should be preserved (only the FK column nulled), not deleted`
      ).toBe(1);
      expect(
        preserved[0][col],
        `${table}.${col} should be NULL for the deleted user (privacy: preserve row, sever linkage)`
      ).toBeNull();
    }

    // Mark testUserId as already cleaned so afterAll doesn't try again.
    testUserId = null;
  }, 60_000);

  it('DEPENDENT_TABLES list is exhaustive vs the live schema', async () => {
    // Regression catcher: query information_schema for every table that
    // has an FK to users.id, and assert each one is covered by either
    // DEPENDENT_TABLES (must be empty after delete) or PRESERVE_BUT_NULL
    // (must still exist with FK column NULL).
    //
    // If a future migration adds a new table referencing users.id, this
    // assertion fails — forcing the author to either:
    //   1. Add ON DELETE CASCADE on the FK and add the table here, OR
    //   2. Add explicit DELETE in db.deleteUser and add the table here.
    // Either way, the new table can't ship without being thought through.
    const { rows } = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND ccu.table_name = 'users'
        AND ccu.column_name = 'id'
      ORDER BY tc.table_name, kcu.column_name
    `);

    const covered = new Set([
      ...DEPENDENT_TABLES.map(([t, c]) => `${t}.${c}`),
      ...PRESERVE_BUT_NULL.map(([t, c]) => `${t}.${c}`),
    ]);
    const uncovered = rows
      .map((r) => `${r.table_name}.${r.column_name}`)
      .filter((key) => !covered.has(key));

    expect(
      uncovered,
      `Schema has FK-to-users tables not covered by the cascade test. ` +
      `Add each to DEPENDENT_TABLES (cleared on delete) or PRESERVE_BUT_NULL ` +
      `(row preserved, FK nulled), and update db.deleteUser if needed: ${uncovered.join(', ')}`
    ).toEqual([]);
  }, 30_000);
});
