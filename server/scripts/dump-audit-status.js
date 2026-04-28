// One-off: prints persisted audit state from admin_settings.
// Run: node --env-file=server/.env server/scripts/dump-audit-status.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

const KEY = 'audit_launch_2026_04_24_status';
const { rows } = await pool.query('SELECT value FROM admin_settings WHERE key=$1', [KEY]);
const state = rows[0]?.value ? JSON.parse(rows[0].value) : {};
console.log(JSON.stringify(state, null, 2));
await pool.end();
