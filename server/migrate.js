// Database structure changes, run by node-pg-migrate on every server start
// (initDb.js) before anything else touches the database.
//
// Each file in db-migrations/ runs once, in order, inside a transaction, and
// is recorded in the pgmigrations table, so the database always knows which
// changes it has. To change the structure, add a new migration — see
// db-migrations/README.md. Never edit one that has already been deployed.
//
// While two servers overlap during a deploy, the second waits for the first
// to finish (advisory lock) instead of running the same migration twice.

import { runner } from 'node-pg-migrate';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(here, 'db-migrations');

export async function runMigrations({ databaseUrl = process.env.DATABASE_URL, direction = 'up', count, log } = {}) {
  return runner({
    databaseUrl: {
      connectionString: databaseUrl,
      ssl: databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false },
    },
    dir: MIGRATIONS_DIR,
    // The baseline's SQL and the README live beside the migrations.
    ignorePattern: '(\\..*)|(.*\\.md)',
    direction,
    count,
    migrationsTable: 'pgmigrations',
    checkOrder: true,
    advisoryLockMode: 'wait',
    log: log ?? ((msg) => console.log(`[migrate] ${msg}`)),
  });
}
