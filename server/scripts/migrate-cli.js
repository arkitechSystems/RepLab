// Local helper for database migrations (see db-migrations/README.md).
//
//   npm run migrate:create -- <name>   new empty migration file
//   npm run migrate:up                 apply pending migrations (the server also does this on start)
//   npm run migrate:down               undo the most recent migration
//
// up/down only run against a database on this computer (localhost) unless
// ALLOW_REMOTE_DB=1 is set — server/.env points at production.

import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { runMigrations, MIGRATIONS_DIR } from '../migrate.js';

const [command, name] = process.argv.slice(2);

if (command === 'create') {
  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    console.error('Usage: npm run migrate:create -- <name-in-kebab-case>');
    process.exit(1);
  }
  const file = join(MIGRATIONS_DIR, `${Date.now()}_${name}.js`);
  if (existsSync(file)) throw new Error(`${file} already exists`);
  writeFileSync(file, `// ${name}

export const up = (pgm) => {
  pgm.sql(\`\`);
};

// Undo \`up\`, or \`export const down = false;\` if it can't be undone.
export const down = (pgm) => {
  pgm.sql(\`\`);
};
`);
  console.log(`Created ${file}`);
} else if (command === 'up' || command === 'down') {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1'].includes(host) && process.env.ALLOW_REMOTE_DB !== '1') {
    console.error(`Refusing to run against ${host} — not a local database. Set ALLOW_REMOTE_DB=1 if you really mean it.`);
    process.exit(1);
  }
  await runMigrations({ direction: command, count: command === 'down' ? 1 : Infinity });
} else {
  console.error('Usage: migrate-cli.js create <name> | up | down');
  process.exit(1);
}
