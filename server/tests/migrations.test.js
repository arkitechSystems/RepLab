// Database migrations (migrate.js + db-migrations/).
//
// The baseline file checks run anywhere. The rest need a local Postgres
// (DATABASE_URL — see e2e/README.md) and are skipped otherwise: each test makes
// its own throwaway database next to the test one and drops it afterwards.

import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import { runMigrations, MIGRATIONS_DIR } from '../migrate.js';

const HAS_DB = !!process.env.DATABASE_URL;
const describeIfDb = HAS_DB ? describe : describe.skip;
const quiet = () => {};

describe('migration files', () => {
  it('the baseline SQL has no session settings that would leak into later migrations', () => {
    const sql = readFileSync(join(MIGRATIONS_DIR, 'baseline', 'schema.sql'), 'utf8');
    expect(sql).not.toMatch(/^SET /m);
    expect(sql).not.toMatch(/set_config/);
    expect(sql).not.toMatch(/^\\(un)?restrict/m);
    expect(sql).not.toMatch(/CREATE SCHEMA/);
    expect(sql).toMatch(/CREATE TABLE public\.users \(/);
  });

  it('every migration file is named <timestamp>_<name>.js', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.js'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(f).toMatch(/^\d{13}_[a-z0-9-]+\.js$/);
  });
});

describeIfDb('migrations (integration)', () => {
  const admin = () => new pg.Client({ connectionString: process.env.DATABASE_URL });
  const created = [];

  async function freshDatabase(label) {
    const name = `replab_migtest_${label}_${Date.now()}`;
    const c = admin();
    await c.connect();
    await c.query(`CREATE DATABASE ${name}`);
    await c.end();
    created.push(name);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${name}`;
    return url.toString();
  }

  async function query(url, sql) {
    const c = new pg.Client({ connectionString: url });
    await c.connect();
    try { return (await c.query(sql)).rows; } finally { await c.end(); }
  }

  afterAll(async () => {
    const c = admin();
    await c.connect();
    for (const name of created) await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.end();
  });

  it('builds a brand-new database from the baseline, and a second run does nothing', async () => {
    const url = await freshDatabase('new');
    const first = await runMigrations({ databaseUrl: url, log: quiet });
    expect(first.map((m) => m.name)).toContain('1791849600000_baseline');

    const tables = (await query(url, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`))
      .map((r) => r.table_name);
    for (const t of ['users', 'programs', 'templates', 'template_exercises', 'sessions', 'session_entries',
      'personal_bests', 'schedule_days', 'exercises', 'app_installs', 'community_likes', 'user_identities']) {
      expect(tables).toContain(t);
    }
    const [{ start }] = await query(url, `SELECT start_value AS start FROM pg_sequences WHERE sequencename = 'users_account_id_seq'`);
    expect(Number(start)).toBe(23231);

    const second = await runMigrations({ databaseUrl: url, log: quiet });
    expect(second).toEqual([]);
  }, 60000);

  it('on an existing database (like production) the baseline changes nothing but is recorded', async () => {
    const url = await freshDatabase('existing');
    await query(url, `CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT)`);

    await runMigrations({ databaseUrl: url, log: quiet });

    const tables = (await query(url, `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`))
      .map((r) => r.table_name);
    expect(tables).toEqual(['pgmigrations', 'users']);
    const recorded = (await query(url, 'SELECT name FROM pgmigrations')).map((r) => r.name);
    expect(recorded).toEqual(['1791849600000_baseline']);
  }, 60000);

  it('two servers starting at once build the database once', async () => {
    const url = await freshDatabase('race');
    const [a, b] = await Promise.all([
      runMigrations({ databaseUrl: url, log: quiet }),
      runMigrations({ databaseUrl: url, log: quiet }),
    ]);
    expect(a.length + b.length).toBe(1);
    const recorded = await query(url, 'SELECT name FROM pgmigrations');
    expect(recorded).toHaveLength(1);
  }, 60000);
});
