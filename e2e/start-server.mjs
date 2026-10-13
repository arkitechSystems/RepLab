// Starts the RepLab server for Playwright against the local test database.
//
// - Refuses any database that isn't on this computer (never production).
// - Wipes the test database; the server rebuilds it on start (migrations in
//   server/db-migrations, then the seeds in initDb.js), so every run starts
//   from the same seeded state.
// - Serves the built website from client/dist (run `npm run build` in client/
//   first — `npm run e2e` at the repo root does both).
// - Leaves out email, payment, AI and push keys so nothing real is sent.
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(here, '..', 'server');
const clientDist = path.join(here, '..', 'client', 'dist', 'index.html');

export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL || 'postgres://replab:replab@localhost:5433/replab_e2e';
export const E2E_PORT = Number(process.env.E2E_PORT || 3101);

const host = new URL(E2E_DATABASE_URL).hostname;
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`Refusing to run end-to-end tests against ${host} — local test database only.`);
  process.exit(1);
}
if (!existsSync(clientDist)) {
  console.error('client/dist is missing — run `npm run build` in client/ first.');
  process.exit(1);
}

for (const key of Object.keys(process.env)) {
  if (/RESEND|STRIPE|ANTHROPIC|YOUTUBE|FIREBASE|SENTRY|APNS|FCM|POSTHOG|ADMIN_/.test(key)) {
    delete process.env[key];
  }
}
Object.assign(process.env, {
  DATABASE_URL: E2E_DATABASE_URL,
  PORT: String(E2E_PORT),
  NODE_ENV: 'development',
  JWT_SECRET: 'e2e-only-secret-key-at-least-thirty-two-characters',
});

// Fresh database every run.
const require = createRequire(path.join(serverDir, 'package.json'));
const { Client } = require('pg');
const client = new Client({ connectionString: E2E_DATABASE_URL });
await client.connect();
await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await client.end();

// index.js builds the schema, seeds it and starts listening.
await import(pathToFileURL(path.join(serverDir, 'index.js')).href);
