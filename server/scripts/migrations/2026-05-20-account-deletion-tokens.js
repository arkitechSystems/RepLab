// Migration: account_deletion_tokens table (Google Play 2024 account-deletion
// policy compliance). Adds support for the public web /delete-account flow.
//
// Idempotent — safe to re-run. initDb.js also creates this table on every
// server boot, so in normal deployments this script is informational; it
// exists for ops contexts where you want to apply the migration without
// restarting the API (e.g. running a backfill before the new code ships).
//
// Run: node --env-file=server/.env server/scripts/migrations/2026-05-20-account-deletion-tokens.js

import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

async function main() {
  console.log('Creating account_deletion_tokens table (if not exists)...');
  await pool.query(`CREATE TABLE IF NOT EXISTS account_deletion_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    request_ip TEXT
  )`);

  console.log('Creating indexes...');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_account_deletion_tokens_user ON account_deletion_tokens(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_account_deletion_tokens_hash ON account_deletion_tokens(token_hash)`);

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_name = 'account_deletion_tokens'`
  );
  console.log(`Done. account_deletion_tokens present: ${rows[0]?.n === 1 ? 'yes' : 'no'}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Migration failed:', err);
    pool.end();
    process.exit(1);
  });
