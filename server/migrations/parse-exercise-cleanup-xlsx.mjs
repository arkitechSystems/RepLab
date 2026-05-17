// Parses the conversion spreadsheet into two JSON files for downstream use.
//
// Input:  _marketing/replab-exercise-library-2026-05-17 (Conversion).xlsx
//   Sheet 1: "Duplicates to Convert"
//     Cols A..I match the exercise library export
//     Col J: target exercise ID to redirect to
//   Sheet 2: "New Muscle Group"
//     Same A..I shape; only col C (muscle_group) matters
//
// Output:
//   server/migrations/data/duplicates-to-convert.json
//   server/migrations/data/new-muscle-group.json
//
// Run:  node --env-file=server/.env server/migrations/parse-exercise-cleanup-xlsx.mjs

import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE = path.join(REPO_ROOT, '_marketing', 'replab-exercise-library-2026-05-17 (Conversion).xlsx');
const OUT_DIR = path.join(__dirname, 'data');

// Case-insensitive sheet lookup — the actual file uses lowercase variants.
const SHEET_DUP_RX = /^duplicates to convert$/i;
const SHEET_MG_RX = /^new muscle group$/i;
const SHEET_EX_RX = /^exercises$/i;

function findSheet(wb, rx) {
  const name = wb.SheetNames.find((n) => rx.test(n));
  return name ? wb.Sheets[name] : null;
}

// Map a header row to canonical lowercase keys.
function normalizeKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function sheetToObjects(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  if (raw.length === 0) return [];
  const header = raw[0].map(normalizeKey);
  const out = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i];
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = row[c];
    out.push(obj);
  }
  return out;
}

async function main() {
  console.log(`[parse] reading ${SOURCE}`);
  const wb = XLSX.readFile(SOURCE);
  console.log(`[parse] sheets: ${wb.SheetNames.join(', ')}`);

  const sheetDup = findSheet(wb, SHEET_DUP_RX);
  const sheetMG = findSheet(wb, SHEET_MG_RX);
  const sheetEx = findSheet(wb, SHEET_EX_RX);
  if (!sheetDup) throw new Error('Missing sheet matching /duplicates to convert/i');
  if (!sheetMG) throw new Error('Missing sheet matching /new muscle group/i');

  const duplicates = sheetToObjects(sheetDup);
  const muscleGroup = sheetToObjects(sheetMG);
  const exercises = sheetEx ? sheetToObjects(sheetEx) : [];

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OUT_DIR, 'duplicates-to-convert.json'),
    JSON.stringify(duplicates, null, 2)
  );
  await fs.writeFile(
    path.join(OUT_DIR, 'new-muscle-group.json'),
    JSON.stringify(muscleGroup, null, 2)
  );
  if (exercises.length > 0) {
    await fs.writeFile(
      path.join(OUT_DIR, 'exercises-sheet.json'),
      JSON.stringify(exercises, null, 2)
    );
  }

  console.log(`[parse] ${duplicates.length} rows in "Duplicates to Convert"`);
  console.log(`[parse] ${muscleGroup.length} rows in "New Muscle Group"`);
  if (exercises.length > 0) console.log(`[parse] ${exercises.length} rows in "Exercises"`);

  console.log('\n[parse] sample "Duplicates to Convert":');
  console.log(JSON.stringify(duplicates.slice(0, 3), null, 2));
  console.log('\n[parse] sample "New Muscle Group":');
  console.log(JSON.stringify(muscleGroup.slice(0, 3), null, 2));
  if (exercises.length > 0) {
    console.log('\n[parse] sample "Exercises":');
    console.log(JSON.stringify(exercises.slice(0, 3), null, 2));
  }
}

main().catch((err) => {
  console.error('[parse] failed:', err.message);
  process.exit(1);
});
