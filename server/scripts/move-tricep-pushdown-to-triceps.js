// One-off: move every master-library exercise whose name contains both
// "Tricep" and "Pushdown" into the Triceps muscle group. Some Pushdown
// variants (Cable Tricep Pushdown, Rope Tricep Pushdown, Reverse Grip
// Tricep Pushdown, etc.) ended up tagged to other muscle groups during
// the original library seed; this script normalizes them so the
// Triceps filter in the Exercise Library surfaces all of them together.
//
// Default mode is --dry-run (no writes). Pass --apply to commit.
//
// Run:
//   cd server
//   node --env-file=.env scripts/move-tricep-pushdown-to-triceps.js           (dry-run)
//   node --env-file=.env scripts/move-tricep-pushdown-to-triceps.js --apply   (writes)

import pool from '../dbPool.js';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const TARGET_MUSCLE = 'Triceps';

async function main() {
  console.log('─────────────────────────────────────────────────');
  console.log(' REPLAB master library — tricep pushdown reassignment');
  console.log('─────────────────────────────────────────────────');
  console.log(`Mode: ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log(`Target muscle_group: "${TARGET_MUSCLE}"\n`);

  // Match any master-library row whose name contains both "tricep" and
  // "pushdown" (case-insensitive). ILIKE %X%Y% is order-sensitive, and
  // both orderings exist in the wild ("Tricep Cable Pushdown" vs "Cable
  // Pushdown for Triceps"), so we test for both substrings independently.
  const { rows } = await pool.query(
    `SELECT id, name, muscle_group FROM exercises
     WHERE created_by IS NULL
       AND name ILIKE '%tricep%'
       AND name ILIKE '%pushdown%'
     ORDER BY name`
  );

  if (!rows.length) {
    console.log('No matching exercises found.');
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} matching exercise(s):\n`);
  const toUpdate = [];
  for (const r of rows) {
    const willChange = r.muscle_group !== TARGET_MUSCLE;
    const tag = willChange ? '→' : '✓';
    console.log(`  ${tag} id=${String(r.id).padEnd(5)} "${r.name}"`);
    console.log(`        muscle_group: "${r.muscle_group}" ${willChange ? `→ "${TARGET_MUSCLE}"` : '(already correct)'}`);
    if (willChange) toUpdate.push(r);
  }

  if (!toUpdate.length) {
    console.log('\nAll matching rows already in Triceps. Nothing to do.');
    await pool.end();
    return;
  }

  if (!APPLY) {
    console.log(`\n${toUpdate.length} row(s) would be reassigned. Pass --apply to commit.`);
    await pool.end();
    return;
  }

  console.log(`\nApplying ${toUpdate.length} update(s)...\n`);
  const ids = toUpdate.map((r) => r.id);
  const result = await pool.query(
    `UPDATE exercises SET muscle_group = $1 WHERE id = ANY($2::int[]) AND created_by IS NULL`,
    [TARGET_MUSCLE, ids]
  );
  console.log(`✓ Updated ${result.rowCount} row(s).`);
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
