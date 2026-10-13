// Baseline: builds the whole database (baseline/schema.sql, taken from
// production 2026-10-13) — but only on a brand-new database. Production and
// any existing database already have these tables, so there it does nothing
// except get recorded as run. Every later change is its own migration.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

export async function up(pgm) {
  const { rows } = await pgm.db.query(`SELECT to_regclass('public.users') AS users`);
  if (rows[0].users) return;
  pgm.sql(readFileSync(join(here, 'baseline', 'schema.sql'), 'utf8'));
}

// No way back from the baseline: undoing it would drop every table.
export const down = false;
