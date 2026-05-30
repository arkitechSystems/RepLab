// One-off rename: normalize master-library exercise names so "Barbell" or
// "Dumbbell" always comes FIRST when present in the name. Improves search
// consistency (typing "barbell" surfaces all barbell variants in one block)
// and matches the existing canonical pattern (e.g. "Barbell Incline Bench
// Press" rather than "Incline Barbell Bench Press").
//
// Examples:
//   "Incline Barbell Bench Press"    → "Barbell Incline Bench Press"
//   "Decline Barbell Bench Press"    → "Barbell Decline Bench Press"
//   "Incline Dumbbell Bench Press"   → "Dumbbell Incline Bench Press"
//   "Standing Dumbbell Press"        → "Dumbbell Standing Press"
//   "Barbell Bench Press"            → unchanged (already first)
//   "Pull-Up"                        → unchanged (no Barbell/Dumbbell)
//
// Skips:
//   - user-created exercises (created_by IS NOT NULL)
//   - names already starting with Barbell or Dumbbell
//   - names containing both Barbell AND Dumbbell (ambiguous — manual review)
//
// Default is --dry-run (no writes). Pass --apply to commit.
//
// Run:
//   cd server
//   node --env-file=.env scripts/rename-barbell-dumbbell-first.js          (dry-run)
//   node --env-file=.env scripts/rename-barbell-dumbbell-first.js --apply  (writes)

import pool from '../dbPool.js';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');

function reorderName(name) {
  if (typeof name !== 'string') return { changed: false, next: name };

  const hasBarbell = /\bBarbell\b/i.test(name);
  const hasDumbbell = /\bDumbbell\b/i.test(name);

  // Ambiguous — skip for manual review.
  if (hasBarbell && hasDumbbell) return { changed: false, next: name, reason: 'both-present' };

  for (const equip of ['Barbell', 'Dumbbell']) {
    const re = new RegExp(`\\b${equip}\\b`);
    const match = name.match(re);
    if (!match) continue;
    if (match.index === 0) return { changed: false, next: name, reason: 'already-first' };
    // Remove the equipment word from its current position and prepend.
    // Collapse double-spaces left behind by the removal.
    const cleaned = name.replace(re, '').replace(/\s+/g, ' ').trim();
    return { changed: true, next: `${equip} ${cleaned}` };
  }
  return { changed: false, next: name, reason: 'no-equipment-keyword' };
}

async function main() {
  console.log('─────────────────────────────────────────────────────────────');
  console.log(' REPLAB master library — rename Barbell/Dumbbell to first word');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Mode: ${APPLY ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}\n`);

  const { rows: exercises } = await pool.query(
    `SELECT id, name FROM exercises
     WHERE created_by IS NULL
     ORDER BY LOWER(name)`
  );
  console.log(`Scanned ${exercises.length} master-library rows.\n`);

  const renames = [];
  for (const ex of exercises) {
    const { changed, next } = reorderName(ex.name);
    if (changed) renames.push({ id: ex.id, from: ex.name, to: next });
  }

  if (!renames.length) {
    console.log('No rows need renaming. Library is already canonical.');
    await pool.end();
    return;
  }

  console.log(`Will rename ${renames.length} row(s):\n`);
  for (const r of renames) {
    console.log(`  ${String(r.id).padEnd(5)} "${r.from}"`);
    console.log(`        → "${r.to}"`);
  }

  if (!APPLY) {
    console.log('\nThis was a dry-run. Pass --apply to commit the changes.');
    await pool.end();
    return;
  }

  console.log('\nApplying renames...\n');
  let written = 0;
  let errored = 0;
  for (const r of renames) {
    try {
      const result = await pool.query(
        `UPDATE exercises SET name = $1 WHERE id = $2 AND created_by IS NULL`,
        [r.to, r.id]
      );
      if (result.rowCount === 1) {
        written++;
        console.log(`  ✓ id=${r.id} "${r.from}" → "${r.to}"`);
      } else {
        errored++;
        console.log(`  ⚠ id=${r.id} no rows updated (row missing or not master?)`);
      }
    } catch (err) {
      errored++;
      console.error(`  ⚠ id=${r.id} update failed: ${err.message}`);
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`Written: ${written}`);
  console.log(`Errored: ${errored}`);
  console.log('─────────────────────────────────');
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
