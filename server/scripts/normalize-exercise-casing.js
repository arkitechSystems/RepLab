// Normalize master exercise names to Title Case: every word's first letter
// capitalized, all-caps and all-lower words rewritten, mixed-case names left
// alone (so "T-Bar Row" doesn't get touched). Propagates the rename through
// every table that denormalizes the name, matching the pattern in
// server/routes/admin.js's rename endpoint.
//
// Acronyms that should STAY all-caps (DB, BB, KB, EZ, JM, RDL, GHR, etc.)
// are preserved via the KEEP_UPPER set below.
//
// Default: preview-only. Pass `--apply` to actually update the DB.
// Run: node --env-file=server/.env server/scripts/normalize-exercise-casing.js [--apply]
import pool from '../dbPool.js';

// Acronyms / abbreviations that should always be all-caps regardless of
// where they appear in the name. Add to this set if a rename produces a
// wrong-looking result.
const KEEP_UPPER = new Set([
  'DB', 'BB', 'KB',           // dumbbell, barbell, kettlebell
  'EZ',                       // EZ bar
  'RDL', 'GHR', 'GHD', 'OHP', // common lift abbreviations + glute-ham developer
  'JM',                       // JM Press (Jeff McMillan)
  'PR', '1RM',                // performance terms
  'AMRAP', 'EMOM', 'RPE',     // CrossFit / programming
  'TRX',                      // suspension trainer
]);

// Per the user spec ("first letter of each word"), every word gets its first
// letter capitalized — even prepositions like "from" or "of". The only
// exception is "w/", an abbreviation for "with" where capitalizing the W
// looks odd next to the slash.
const KEEP_LOWER = new Set(['w/']);

function titleCaseWord(word, isFirst) {
  if (!/[a-zA-Z]/.test(word)) return word;
  if (KEEP_UPPER.has(word)) return word;
  if (!isFirst && KEEP_LOWER.has(word.toLowerCase())) return word.toLowerCase();

  // Hyphenated: recurse on each segment.
  if (word.includes('-')) {
    return word.split('-').map((p, i) => titleCaseWord(p, isFirst && i === 0)).join('-');
  }

  const lower = word.toLowerCase();
  const upper = word.toUpperCase();
  const isAllCaps = word === upper && /[A-Z]/.test(word);
  const isAllLower = word === lower && /[a-z]/.test(word);

  // Mixed case already (like "T-Bar" after split, or "McMillan") — preserve.
  if (!isAllCaps && !isAllLower) return word;

  return word[0].toUpperCase() + lower.slice(1);
}

function titleCase(name) {
  // Split preserving whitespace so multi-space gaps don't collapse.
  return name.split(/(\s+)/).map((part, idx) => {
    if (/^\s+$/.test(part)) return part;
    return titleCaseWord(part, idx === 0);
  }).join('');
}

const APPLY = process.argv.includes('--apply');

const { rows: exercises } = await pool.query(
  `SELECT id, name FROM exercises WHERE created_by IS NULL ORDER BY LOWER(name)`
);

const renames = [];
for (const ex of exercises) {
  const next = titleCase(ex.name);
  if (next !== ex.name) {
    renames.push({ id: ex.id, before: ex.name, after: next });
  }
}

console.log(`Master library: ${exercises.length} exercises.`);
console.log(`Proposed renames: ${renames.length}\n`);

if (renames.length === 0) {
  console.log('Nothing to change. Library is already Title Cased.');
  process.exit(0);
}

console.log('--- Proposed renames ---');
for (const r of renames) {
  console.log(`  "${r.before}"  →  "${r.after}"`);
}

if (!APPLY) {
  console.log('\n(Preview mode. Re-run with --apply to commit these changes.)');
  process.exit(0);
}

// Apply renames in a transaction. Each rename updates the master row + all
// denormalized name columns scoped by exercise_id (the Path B canonical FK).
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const r of renames) {
    await client.query('UPDATE exercises SET name = $1 WHERE id = $2', [r.after, r.id]);
    await client.query('UPDATE template_exercises SET name = $1 WHERE exercise_id = $2', [r.after, r.id]);
    await client.query('UPDATE session_entries SET exercise_name = $1 WHERE exercise_id = $2', [r.after, r.id]);
    await client.query('UPDATE personal_bests SET exercise_name = $1 WHERE exercise_id = $2', [r.after, r.id]);
  }
  await client.query('COMMIT');
  console.log(`\nApplied ${renames.length} renames.`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Transaction failed, rolled back:', err);
  process.exit(1);
} finally {
  client.release();
}

process.exit(0);
