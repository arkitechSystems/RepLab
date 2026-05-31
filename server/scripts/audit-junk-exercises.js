// Read-only audit: flag master-library exercises that look like junk data —
// single-char names, all-lowercase rows (the library was normalized to Title
// Case per the casing migration), test/temp/placeholder keywords, weird
// punctuation, names that are just numbers, etc.
//
// Each flagged row gets a `reasons` array (every heuristic it triggers) and
// a usage count (how many template_exercises + sessions reference it), so you
// can see at a glance which rows are safe to delete (usage = 0) vs. which
// need a careful rename/merge (usage > 0).
//
// Run:
//   cd server
//   node --env-file=.env scripts/audit-junk-exercises.js
//
// To filter to a specific category:
//   node --env-file=.env scripts/audit-junk-exercises.js --reason single-char
//   node --env-file=.env scripts/audit-junk-exercises.js --reason lowercase
//
// This script does NOT write to the database. Once you've reviewed the
// output, delete suspicious rows via the admin dashboard (Exercise Library
// → row → delete) or write a follow-up script with a hand-curated id list.

import pool from '../dbPool.js';

const argv = process.argv.slice(2);
function getOpt(name, fallback) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
}
const REASON_FILTER = getOpt('reason', null);

// ── Heuristics ───────────────────────────────────────────────────────────

const JUNK_KEYWORDS = ['test', 'temp', 'junk', 'placeholder', 'asdf', 'qwer', 'xxx', 'todo', 'fixme', 'delete me'];

function classify(name) {
  const reasons = [];
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // 1. Single character or very short
  if (trimmed.length <= 2) reasons.push('too-short');

  // 2. All lowercase (library was normalized to Title Case)
  if (trimmed.length > 0 && trimmed === lower && /[a-z]/.test(trimmed)) reasons.push('all-lowercase');

  // 3. ALL UPPERCASE (also drifts from the Title Case convention)
  if (trimmed.length > 0 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && !/[a-z]/.test(trimmed)) {
    reasons.push('all-uppercase');
  }

  // 4. Numeric-only or mostly-numeric
  if (/^\d+$/.test(trimmed)) reasons.push('numeric-only');

  // 5. Test/junk keyword
  for (const kw of JUNK_KEYWORDS) {
    if (lower.includes(kw)) {
      reasons.push(`keyword:${kw}`);
      break;
    }
  }

  // 6. Leading/trailing whitespace or double spaces (data hygiene)
  if (name !== trimmed) reasons.push('whitespace-padding');
  if (/  +/.test(name)) reasons.push('double-space');

  // 7. Non-ASCII characters (could be valid for international users, but flag for review on the master library)
  if (/[^\x20-\x7E]/.test(trimmed)) reasons.push('non-ascii');

  // 8. Special characters in unusual positions (e.g. `?`, `!`, weird unicode)
  if (/[?!@#$%^&*~`]/.test(trimmed)) reasons.push('special-chars');

  // 9. Looks like a stub: a single word that isn't a known exercise verb/noun.
  // Hard to do perfectly without a dictionary, so just flag rows that are a
  // single word with no consonant cluster typical of fitness terms. Skip this
  // for now — too noisy. Left as a placeholder for future tuning.

  return reasons;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('───────────────────────────────────────────────');
  console.log(' REPLAB exercise library — junk audit (read-only)');
  console.log('───────────────────────────────────────────────\n');

  // Master library only — exclude user-created exercises (created_by IS NOT NULL)
  // since those are the user's own data, not seed/master rows.
  const { rows: exercises } = await pool.query(
    `SELECT id, name, muscle_group, video_id, video_linked_by, is_custom
     FROM exercises
     WHERE created_by IS NULL
     ORDER BY id`
  );

  console.log(`Scanned ${exercises.length} master-library rows\n`);

  // Lowercased-name → [ids] map for duplicate detection
  const nameMap = new Map();
  for (const ex of exercises) {
    const key = ex.name.trim().toLowerCase();
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key).push(ex);
  }

  // Build the flagged list
  const flagged = [];
  for (const ex of exercises) {
    const reasons = classify(ex.name);

    // Duplicate detection (only flag the second+ occurrence so we don't
    // double-list both halves of a legitimate near-duplicate where one is
    // canonical).
    const dupes = nameMap.get(ex.name.trim().toLowerCase()) || [];
    if (dupes.length > 1 && dupes[0].id !== ex.id) {
      reasons.push(`duplicate-of:${dupes[0].id}`);
    }

    if (reasons.length === 0) continue;
    if (REASON_FILTER && !reasons.some((r) => r.startsWith(REASON_FILTER))) continue;

    flagged.push({ ...ex, reasons });
  }

  if (!flagged.length) {
    console.log(REASON_FILTER ? `No rows flagged for reason "${REASON_FILTER}".` : 'No junk-looking rows found. Library is clean.');
    await pool.end();
    return;
  }

  // Look up usage counts in batch (safer than N+1 queries)
  const ids = flagged.map((f) => f.id);
  const { rows: usageRows } = await pool.query(
    `SELECT e.id,
            COALESCE(te.cnt, 0) AS template_uses,
            COALESCE(se.cnt, 0) AS session_uses,
            COALESCE(pb.cnt, 0) AS pb_uses
     FROM exercises e
     LEFT JOIN (SELECT exercise_id, COUNT(*) AS cnt FROM template_exercises GROUP BY exercise_id) te ON te.exercise_id = e.id
     LEFT JOIN (SELECT exercise_id, COUNT(*) AS cnt FROM session_entries GROUP BY exercise_id) se ON se.exercise_id = e.id
     LEFT JOIN (SELECT exercise_id, COUNT(*) AS cnt FROM personal_bests GROUP BY exercise_id) pb ON pb.exercise_id = e.id
     WHERE e.id = ANY($1::int[])`,
    [ids]
  );
  const usageById = new Map(usageRows.map((r) => [r.id, r]));

  // Sort: safe-to-delete (zero usage) first, then by reason severity
  flagged.sort((a, b) => {
    const ua = usageById.get(a.id) || { template_uses: 0, session_uses: 0, pb_uses: 0 };
    const ub = usageById.get(b.id) || { template_uses: 0, session_uses: 0, pb_uses: 0 };
    const totalA = Number(ua.template_uses) + Number(ua.session_uses) + Number(ua.pb_uses);
    const totalB = Number(ub.template_uses) + Number(ub.session_uses) + Number(ub.pb_uses);
    if (totalA !== totalB) return totalA - totalB;
    return a.id - b.id;
  });

  // Render
  console.log(`Flagged: ${flagged.length} row(s)\n`);
  for (const f of flagged) {
    const u = usageById.get(f.id) || { template_uses: 0, session_uses: 0, pb_uses: 0 };
    const total = Number(u.template_uses) + Number(u.session_uses) + Number(u.pb_uses);
    const safetyTag = total === 0
      ? '✓ safe to delete'
      : `⚠ in use: ${u.template_uses} template / ${u.session_uses} session / ${u.pb_uses} pb`;

    console.log(`  id=${String(f.id).padEnd(4)} "${f.name}"`);
    console.log(`    muscle:    ${f.muscle_group || '-'}`);
    console.log(`    video:     ${f.video_id || 'none'}${f.video_linked_by ? ` (${f.video_linked_by})` : ''}`);
    console.log(`    reasons:   ${f.reasons.join(', ')}`);
    console.log(`    usage:     ${safetyTag}`);
    console.log('');
  }

  // Summary by reason
  const reasonCounts = new Map();
  for (const f of flagged) {
    for (const r of f.reasons) {
      const key = r.split(':')[0];
      reasonCounts.set(key, (reasonCounts.get(key) || 0) + 1);
    }
  }
  console.log('─────────────────────────────────');
  console.log('Breakdown by reason:');
  for (const [reason, count] of [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(22)} ${count}`);
  }
  console.log('─────────────────────────────────');
  console.log('\nThis is a read-only audit. To act on findings:');
  console.log('  - Safe to delete (usage=0): remove via admin dashboard → Exercise Library → row → delete.');
  console.log('  - In use:                   rename or merge (the admin "Linked By" / video edit flow does NOT rename — write a follow-up migration if you want to rename in bulk).');
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
