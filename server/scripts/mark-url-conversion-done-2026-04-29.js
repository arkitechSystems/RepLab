// One-off: mark a second batch of URL Conversion items DONE based on
// today's session — bundle ID rename + verified-clean Section A items
// + already-pre-added deep-link hosts. Idempotent, safe to re-run.
//
// Run: node --env-file=server/.env server/scripts/mark-url-conversion-done-2026-04-29.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

const KEY = 'audit_launch_2026_04_24_status';

const updates = {
  // Section A — verified clean in code (billing.js uses APP_URL env var,
  // no will-fit.shop references in flagged files).
  urc_a1: 'done', // server/email.js — no will-fit.shop hits
  urc_a2: 'done', // server/routes/trainer.js — no will-fit.shop hits
  urc_a3: 'done', // server/routes/admin.js admin password-reset — no hit
  urc_a4: 'done', // server/routes/admin.js noreply@ — no hit
  urc_a5: 'done', // server/routes/billing.js — uses process.env.APP_URL
  urc_a6: 'done', // client/src/pages/Workouts.jsx — no will-fit.shop hit

  // Section B — bundle ID locked in as com.replab.fitness
  urc_b1: 'done', // Decision: com.replab.fitness
  urc_b2: 'done', // client/capacitor.config.json appId
  urc_b3: 'done', // iOS PRODUCT_BUNDLE_IDENTIFIER (Debug + Release)
  urc_b4: 'done', // Android namespace + applicationId in build.gradle
  urc_b5: 'done', // Java directory rename + MainActivity.java package
  urc_b6: 'done', // Android strings.xml package_name + custom_url_scheme
  urc_b7: 'done', // Expo mobile/app.json bundleIdentifier + package

  // Section G — host pre-adds (Team ID + signing fingerprint still pending)
  urc_g3: 'done', // deepLink.js APP_HOSTS already includes replab-fitness.com
  urc_g4: 'done', // AndroidManifest intent-filter already lists both hosts
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
