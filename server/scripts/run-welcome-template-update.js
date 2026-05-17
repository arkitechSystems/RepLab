// One-off: apply update-welcome-email-template.sql against the connected DB.
// Captures the row's pre-state (so you have a rollback reference) before applying.
//
// Run: node --env-file=server/.env server/scripts/run-welcome-template-update.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../dbPool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, 'update-welcome-email-template.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const { rows: before } = await pool.query(
  "SELECT name, subject, LEFT(html, 80) AS html_preview, LENGTH(html) AS html_len, updated_at FROM email_templates WHERE name = 'welcome'"
);
console.log('--- BEFORE ---');
console.log(JSON.stringify(before, null, 2));

console.log('--- APPLYING SQL ---');
await pool.query(sql);
console.log('OK.');

const { rows: after } = await pool.query(
  "SELECT name, subject, LEFT(html, 80) AS html_preview, LENGTH(html) AS html_len, updated_at FROM email_templates WHERE name = 'welcome'"
);
console.log('--- AFTER ---');
console.log(JSON.stringify(after, null, 2));

process.exit(0);
