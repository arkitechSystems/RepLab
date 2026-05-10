// One-off: dump the current welcome email_templates row so we can compare to the default.
// Run: node --env-file=server/.env server/scripts/dump-welcome-template.js
import pool from '../dbPool.js';
import fs from 'fs';

const { rows } = await pool.query("SELECT name, subject, html, updated_at FROM email_templates WHERE name = 'welcome'");

if (!rows[0]) {
  console.log('No welcome row in email_templates.');
  process.exit(0);
}

const row = rows[0];
console.log('Subject:    ', row.subject);
console.log('Updated at: ', row.updated_at);
console.log('HTML length:', row.html?.length, 'chars');

const out = 'C:\\Users\\WillMartin\\OneDrive - Partners Healthcare Group\\Desktop\\Will Drive\\WorkoutApp\\_marketing\\current-welcome-email.html';
fs.writeFileSync(out, row.html || '');
console.log('Wrote HTML to:', out);

process.exit(0);
