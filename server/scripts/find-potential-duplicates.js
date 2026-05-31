// Read-only audit: scan the master library for potential duplicate
// exercises using progressively looser normalization keys. Each pass groups
// rows by a different normalized key; groups with >1 row are printed. A
// single row can appear under multiple passes — the strongest match
// (exact lowercased) is the highest-confidence dup signal, and each
// successive pass widens the net a bit.
//
// Heuristic-based — does NOT auto-delete anything. The operator reviews
// the output and decides which groups are real duplicates vs. legitimate
// variants (e.g. "Cable Curl" and "Single-Arm Cable Curl" are NOT dups).

import pool from '../dbPool.js';

function stripParens(s) {
  // "Cable Curl (Pyramid)" → "Cable Curl"
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function reorderEquipmentFirst(s) {
  // "Decline Barbell Press" → "Barbell Decline Press"
  for (const eq of ['Barbell', 'Dumbbell', 'Cable', 'Machine']) {
    const re = new RegExp(`\\b${eq}\\b`, 'i');
    const m = s.match(re);
    if (m && m.index > 0) {
      const cleaned = s.replace(re, '').replace(/\s+/g, ' ').trim();
      return `${eq} ${cleaned}`;
    }
  }
  return s;
}

function stripPluralLastWord(s) {
  // Conservative plural-strip: only on the LAST word, only if it ends in 's',
  // and only if it's >3 chars (so "Press"→"Pres" doesn't fire — len 5 but
  // ends in 's'... hmm). Whitelist of stems that take 's' meaningfully:
  // Curl, Raise, Row, Pushdown, Pulldown, Pull, Press (NO — Press always
  // ends in 's', skip), Extension, Fly, Flye. Strategy: only strip if the
  // LAST char is 's' AND the second-to-last is NOT also 's' (so "Press"
  // with double-s tail is excluded) AND the word isn't a known
  // singular-form-ends-in-s like Press / Status / Bus etc. Conservative
  // single-character whitelist check on the second-to-last char would
  // help — but simpler: hardcode a deny-list of words to NOT strip.
  const DENY = new Set(['press', 'biceps', 'triceps', 'lats', 'abs', 'situps', 'pushups', 'pullups', 'chinups']);
  const words = s.split(/\s+/);
  const last = words[words.length - 1];
  if (!last) return s;
  const lower = last.toLowerCase();
  if (DENY.has(lower)) return s;
  if (lower.length <= 3) return s;
  if (!lower.endsWith('s')) return s;
  // Skip double-s endings ("press" handled above, also catches grass etc.)
  if (lower.endsWith('ss')) return s;
  words[words.length - 1] = last.slice(0, -1);
  return words.join(' ');
}

function normalize(s, { stripParens: sp = true, reorder = true, stripPlural = true } = {}) {
  let out = String(s || '').trim();
  if (sp) out = stripParens(out);
  if (reorder) out = reorderEquipmentFirst(out);
  out = out.toLowerCase();
  // Collapse punctuation/whitespace
  out = out.replace(/[-_/]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (stripPlural) out = stripPluralLastWord(out);
  return out;
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].filter(([, v]) => v.length > 1);
}

function printGroups(title, groups) {
  console.log(`\n──── ${title} ────`);
  if (!groups.length) {
    console.log('  (no groups found)');
    return;
  }
  for (const [key, rows] of groups) {
    console.log(`\n  key: "${key}"`);
    for (const r of rows) {
      console.log(`    id=${String(r.id).padEnd(5)} "${r.name}"  muscle="${r.muscle_group}"`);
    }
  }
}

async function main() {
  console.log('────────────────────────────────────────────');
  console.log(' REPLAB master library — duplicate audit');
  console.log('────────────────────────────────────────────');

  const { rows } = await pool.query(
    `SELECT id, name, muscle_group FROM exercises
     WHERE created_by IS NULL
     ORDER BY id`
  );
  console.log(`Scanned ${rows.length} master-library rows.`);

  // Pass 1: exact lowercased name
  const pass1 = groupBy(rows, (r) => r.name.toLowerCase().trim());
  printGroups('PASS 1 — exact lowercased duplicates (HIGH confidence)', pass1);

  // Pass 2: normalize parentheticals, reorder equipment, drop punctuation
  // (skip plural for this pass to isolate the parenthetical signal)
  const pass2Key = (r) => normalize(r.name, { stripPlural: false });
  const pass2Map = new Map();
  for (const r of rows) {
    const k = pass2Key(r);
    if (!pass2Map.has(k)) pass2Map.set(k, []);
    pass2Map.get(k).push(r);
  }
  const pass1Keys = new Set(pass1.map(([k]) => k));
  const pass2 = [...pass2Map.entries()].filter(([k, v]) => v.length > 1 && !pass1Keys.has(k));
  printGroups('PASS 2 — same after stripping parentheticals + reordering Barbell/Dumbbell (MEDIUM confidence)', pass2);

  // Pass 3: + plural normalization on the last word
  const pass3Key = (r) => normalize(r.name, { stripPlural: true });
  const pass3Map = new Map();
  for (const r of rows) {
    const k = pass3Key(r);
    if (!pass3Map.has(k)) pass3Map.set(k, []);
    pass3Map.get(k).push(r);
  }
  const seenKeys = new Set([...pass1.map(([k]) => k), ...pass2.map(([k]) => k)]);
  const pass3 = [...pass3Map.entries()].filter(([k, v]) => v.length > 1 && !seenKeys.has(k));
  printGroups('PASS 3 — same after also stripping plural "s" on last word (LOWER confidence — may include legit variants like "Curl" vs "Curls")', pass3);

  console.log('\n────────────────────────────────────────────');
  const total = pass1.length + pass2.length + pass3.length;
  console.log(` ${total} potential duplicate group(s) found.`);
  console.log('────────────────────────────────────────────');
}

main()
  .catch((err) => { console.error('Fatal:', err); process.exitCode = 1; })
  .finally(async () => { try { await pool.end(); } catch {} });
