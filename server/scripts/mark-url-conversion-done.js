// One-off: mark URL Conversion items DONE / N/A based on work already
// completed this session. Updates the same admin_settings JSON blob that
// /admin/url-conversion reads from (key: audit_launch_2026_04_24_status).
//
// Run: node --env-file=server/.env server/scripts/mark-url-conversion-done.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

const KEY = 'audit_launch_2026_04_24_status';

const updates = {
  // Section A — code references
  urc_a7: 'done', // README rebranded WillFit -> RepLab; no will-fit.shop URLs in README

  // Section H — GitHub repo migration (arkitechSystems/RepLab)
  urc_h1: 'done', // arkitechSystems/RepLab created
  urc_h2: 'done', // arkitech remote added (chose option a: keep origin, add new remote)
  urc_h3: 'done', // user.name set to "ArkiTech Systems" (--local)
  urc_h4: 'done', // user.email set to arkitechcloud@gmail.com (--local)
  urc_h5: 'done', // git push --all to arkitech (main branch pushed)
  urc_h6: 'done', // git push --tags to arkitech (no tags existed but command ran clean)
  urc_h7: 'done', // Render reconnected to arkitechSystems/RepLab; first build succeeded
  urc_h8: 'done', // Render GitHub app installed via Wmartin23 collaborator add
  urc_h9: 'na',   // No GitHub Actions / workflow secrets in this repo
  urc_h10: 'na',  // User chose to leave Wmartin23/WillFit untouched
  urc_h11: 'done', // README updated; no other external docs reference the repo URL
};

const { rows } = await pool.query('SELECT value FROM admin_settings WHERE key = $1', [KEY]);
let state = {};
try { state = rows[0]?.value ? JSON.parse(rows[0].value) : {}; } catch { state = {}; }

for (const [id, status] of Object.entries(updates)) {
  state[id] = status;
}

await pool.query(
  `INSERT INTO admin_settings (key, value) VALUES ($1, $2)
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  [KEY, JSON.stringify(state)]
);

console.log('Updated', Object.keys(updates).length, 'URL Conversion items:');
for (const [id, status] of Object.entries(updates)) {
  console.log(`  ${id} -> ${status.toUpperCase()}`);
}

await pool.end();
