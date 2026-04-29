// One-off diagnostic: is Katie Sonier's program seeded in prod?
// Run: node --env-file=server/.env server/scripts/check-katie-program.js
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

const { rows: progs } = await pool.query(
  "SELECT id, name, sort_order, program_type FROM programs WHERE name ILIKE '%katie%' OR name ILIKE '%sonier%'"
);
console.log('Programs matched:', progs);

if (progs.length > 0) {
  const pid = progs[0].id;
  const { rows: tplCount } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM templates WHERE program_id = $1', [pid]
  );
  console.log(`Templates under program ${pid}:`, tplCount[0].n);
}

await pool.end();
