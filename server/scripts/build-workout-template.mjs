// Builds the trainer workout/program upload template (Excel, Google Sheets compatible).
//
//   node --env-file=.env scripts/build-workout-template.mjs            (exercise list from the DB, read only)
//   node scripts/build-workout-template.mjs --exercises exercises.json  (exercise list from a JSON export)
//   ... --out <path>   (default: ../trainer-template/RepLab-Workout-Template.xlsx)
//
// Google Sheets rules this file follows (so the upload behaves the same in both):
//   - no macros; all "green / red" behavior is formulas + conditional formatting
//   - conditional formatting only references cells on its own sheet (Sheets drops
//     cross-sheet references there), so each sheet keeps its own status cell in column O
//   - only plain functions (IF, AND, OR, COUNTIF, COUNTA, INDEX, MATCH, IFERROR, SUMPRODUCT)
//
// The future Trainer Central importer reads this layout. Bump TEMPLATE_VERSION whenever
// the layout changes and keep the importer in step.

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TEMPLATE_VERSION = 'RepLab Workout Template v1';
const WORKOUT_SHEETS = 12;
const CARDS = 15;             // exercise cards per Workout sheet
const SETS_PER_CARD = 8;      // set rows per card
const CARD_ROWS = 5 + SETS_PER_CARD + 1; // section, band, custom, superset/notes, titles, sets, spacer
const FIRST_CARD_ROW = 6;
const cardTop = (n) => FIRST_CARD_ROW + (n - 1) * CARD_ROWS;
const LAST_ROW = cardTop(CARDS) + CARD_ROWS - 2; // last set row of the last card
const MAX_WEEKS = 52;

// Must match the app (client/src/components/ExerciseCard.jsx SET_TYPES).
const SET_TYPES = [
  ['Regular', 'straight'], ['Warm Up', 'warm_up'], ['Touch Up', 'touch_up'], ['Drop Set', 'drop'],
  ['Rest Pause', 'rest_pause'], ['Super Set', 'superset'], ['Alternating Set', 'alternating'],
  ['Pre-Exhaust', 'pre_exhaust'],
];
// Must match programs.program_type (labels as shown in client/src/pages/Workouts.jsx).
const PROGRAM_TYPES = [
  ['Hypertrophy', 'hypertrophy'], ['Strength', 'strength'], ['Hybrid', 'hybrid'],
  ['Conditioning', 'conditioning'], ['Shred', 'strength_conditioning'],
  ['Hypertrophy & Strength', 'hypertrophy_strength'], ['Glute-Focused', 'glute_focused'], ['Other', 'other'],
];
const SUPERSET_LETTERS = 'ABCDEFGHIJ'.split('');

const args = process.argv.slice(2);
const argValue = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const here = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(argValue('--out') || path.join(here, '../../trainer-template/RepLab-Workout-Template.xlsx'));

async function loadExercises() {
  const file = argValue('--exercises');
  if (file) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const { default: pool } = await import('../dbPool.js');
  const { rows } = await pool.query(
    `SELECT id, name, muscle_group, (video_id IS NOT NULL AND video_id <> '') AS has_video
       FROM exercises WHERE NOT is_custom AND NOT hidden_from_library`);
  await pool.end();
  return rows;
}

// ---------- styling helpers ----------
const C = {
  ink: 'FF111111', white: 'FFFFFFFF', brand: 'FFE10600', dark: 'FF1F1F1F', grey: 'FF6B6B6B',
  head: 'FF2B2B2B', input: 'FFFFFDE7', line: 'FFD0D0D0', green: 'FFC8F7C5', greenInk: 'FF0B6B12',
  red: 'FFFFC9C9', redInk: 'FF9B0000', amber: 'FFFFE8B0', amberInk: 'FF8A5A00', section: 'FFE6E6E6',
  rest: 'FFDDEBFF', muted: 'FFF2F2F2',
};
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thin = { style: 'thin', color: { argb: C.line } };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const font = (o = {}) => ({ name: 'Arial', size: 10, color: { argb: C.ink }, ...o });

function styleHeaderRow(row, from, to) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = font({ bold: true, color: { argb: C.white } });
    cell.fill = fill(C.head);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = box;
  }
  row.height = 32;
}
function inputCell(cell) {
  cell.fill = fill(C.input);
  cell.border = box;
  cell.font = font();
  cell.alignment = { vertical: 'middle', wrapText: true };
}
// Green / red / amber banner driven by the sheet's own status cell ($O$1).
function bannerRules(ws, ref) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      { type: 'expression', priority: 1, formulae: ['$O$1="FILL"'], style: { fill: fill(C.green), font: { bold: true, color: { argb: C.greenInk } } } },
      { type: 'expression', priority: 2, formulae: ['$O$1="SKIP"'], style: { fill: fill(C.red), font: { bold: true, color: { argb: C.redInk } } } },
      { type: 'expression', priority: 3, formulae: ['$O$1=""'], style: { fill: fill(C.amber), font: { bold: true, color: { argb: C.amberInk } } } },
    ],
  });
}
function list(sqref, formula, prompt, strict = true) {
  return {
    type: 'list', allowBlank: true, formulae: [formula],
    showErrorMessage: strict, errorStyle: 'stop', errorTitle: 'Pick from the list',
    error: 'Choose one of the options in the dropdown.',
    showInputMessage: !!prompt, prompt: prompt || '',
  };
}
function hideHelperColumns(ws) {
  ws.getColumn(14).hidden = true; // N
  ws.getColumn(15).hidden = true; // O  (status + problem count)
  ws.getColumn(16).hidden = true; // P
}

// ---------- build ----------
const exercises = (await loadExercises())
  .map((e) => ({ id: e.id, name: String(e.name).trim(), group: e.muscle_group, video: !!e.has_video }))
  .sort((a, b) => a.name.localeCompare(b.name));
const muscleGroups = [...new Set(exercises.map((e) => e.group))].sort();
const LIB_LAST = exercises.length + 1;
const LIB = (col) => `'Exercise Library'!$${col}$2:$${col}$${LIB_LAST}`;

const wb = new ExcelJS.Workbook();
wb.creator = 'RepLab';
wb.calcProperties.fullCalcOnLoad = true;

const start = wb.addWorksheet('Start', { properties: { tabColor: { argb: C.brand } }, views: [{ showGridLines: false }] });
const workouts = [];
for (let n = 1; n <= WORKOUT_SHEETS; n++) {
  workouts.push(wb.addWorksheet(`Workout ${n}`, { properties: { tabColor: { argb: 'FF3A6EA5' } }, views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] }));
}
const sched = wb.addWorksheet('Schedule', { properties: { tabColor: { argb: 'FF7B4FA0' } }, views: [{ state: 'frozen', ySplit: 5, showGridLines: false }] });
const lib = wb.addWorksheet('Exercise Library', { properties: { tabColor: { argb: 'FF808080' } }, views: [{ state: 'frozen', ySplit: 1 }] });
const lists = wb.addWorksheet('Lists', { state: 'hidden' });

// ----- Lists (hidden): dropdown sources + template version -----
lists.getCell('A1').value = 'Workout names';
lists.getCell('A2').value = 'REST';
for (let n = 1; n <= WORKOUT_SHEETS; n++) {
  lists.getCell(`A${n + 2}`).value = { formula: `IF('Workout ${n}'!$O$1="FILL",'Workout ${n}'!$C$3,"")` };
}
const LIST_WORKOUTS = `Lists!$A$2:$A$${WORKOUT_SHEETS + 2}`;
const fillColumn = (col, title, values) => {
  lists.getCell(`${col}1`).value = title;
  values.forEach((v, i) => { lists.getCell(`${col}${i + 2}`).value = v; });
  return `Lists!$${col}$2:$${col}$${values.length + 1}`;
};
const LIST_SET_TYPES = fillColumn('B', 'Set types', SET_TYPES.map(([l]) => l));
lists.getColumn('C').values = ['Set type keys', ...SET_TYPES.map(([, k]) => k)];
const LIST_MUSCLES = fillColumn('D', 'Muscle groups', muscleGroups);
const LIST_SUPERSET = fillColumn('E', 'Superset groups', SUPERSET_LETTERS);
const LIST_KIND = fillColumn('F', 'Creating', ['Single Workout', 'Program']);
const LIST_PROGRAM_TYPES = fillColumn('G', 'Program types', PROGRAM_TYPES.map(([l]) => l));
lists.getColumn('H').values = ['Program type keys', ...PROGRAM_TYPES.map(([, k]) => k)];
lists.getCell('J1').value = 'Template version';
lists.getCell('J2').value = TEMPLATE_VERSION;

// ----- Exercise Library -----
lib.columns = [
  { header: 'ID', key: 'id', width: 8 },
  { header: 'Exercise', key: 'name', width: 44 },
  { header: 'Muscle Group', key: 'group', width: 16 },
  { header: 'Demo Video', key: 'video', width: 12 },
];
exercises.forEach((e) => lib.addRow({ id: e.id, name: e.name, group: e.group, video: e.video ? 'Yes' : 'No' }));
styleHeaderRow(lib.getRow(1), 1, 4);
lib.autoFilter = { from: 'A1', to: `D${LIB_LAST}` };
for (let r = 2; r <= LIB_LAST; r++) lib.getRow(r).font = font();

// ----- Start -----
start.columns = [{ width: 3 }, { width: 38 }, { width: 34 }, { width: 46 }, { width: 3 }];
start.mergeCells('B1:D1');
start.getCell('B1').value = 'RepLab Workout & Program Template';
start.getCell('B1').font = font({ size: 20, bold: true, color: { argb: C.brand } });
start.getRow(1).height = 34;
start.mergeCells('B2:D2');
start.getCell('B2').value = 'Build a workout or a full program here, then upload this file in Trainer Central. Yellow cells are for you to fill in.';
start.getCell('B2').font = font({ italic: true, color: { argb: C.grey } });

const QUESTIONS = [
  // [row, question, hint formula (column D)]
  [4, '1. What are you creating?', 'IF(C4="","⚠ Choose Single Workout or Program","✓")'],
  [5, '2. Program name', 'IF($C$4<>"Program","Not needed for a single workout",IF(C5="","⚠ Required","✓"))'],
  [6, '3. Program description (optional)', 'IF($C$4<>"Program","Not needed for a single workout","Optional — shown to clients")'],
  [7, '4. Program type', 'IF($C$4<>"Program","Not needed for a single workout",IF(C7="","⚠ Required","✓"))'],
  [8, '5. How many weeks? (1–52)', 'IF($C$4<>"Program","Not needed for a single workout",IF(C8="","⚠ Required","✓ Fill weeks 1–"&C8&" on the Schedule sheet"))'],
  [9, `6. How many different workouts? (1–${WORKOUT_SHEETS})`, `IF($C$4<>"Program","Single workout: fill out the Workout 1 sheet",IF(C9="","⚠ Required","✓ Fill out Workout 1–"&C9))`],
  [10, '7. Created by (optional)', '"Your name or business — optional"'],
];
start.getCell('B3').value = 'QUESTIONS';
start.getCell('B3').font = font({ bold: true, color: { argb: C.grey } });
for (const [r, q, hint] of QUESTIONS) {
  start.getCell(`B${r}`).value = q;
  start.getCell(`B${r}`).font = font({ bold: true });
  start.getCell(`B${r}`).alignment = { vertical: 'middle', wrapText: true };
  inputCell(start.getCell(`C${r}`));
  start.getCell(`D${r}`).value = { formula: hint };
  start.getCell(`D${r}`).font = font({ color: { argb: C.grey } });
  start.getCell(`D${r}`).alignment = { vertical: 'middle', wrapText: true };
  start.getRow(r).height = 22;
}
start.dataValidations.add('C4', list('C4', LIST_KIND, 'Single Workout = one workout. Program = several workouts arranged over weeks.'));
start.dataValidations.add('C5', { type: 'textLength', operator: 'lessThanOrEqual', formulae: [200], allowBlank: true, showErrorMessage: true, error: '200 characters or fewer.' });
start.dataValidations.add('C6', { type: 'textLength', operator: 'lessThanOrEqual', formulae: [5000], allowBlank: true, showErrorMessage: true, error: '5000 characters or fewer.' });
start.dataValidations.add('C7', list('C7', LIST_PROGRAM_TYPES));
start.dataValidations.add('C8', { type: 'whole', operator: 'between', formulae: [1, MAX_WEEKS], allowBlank: true, showErrorMessage: true, error: `Enter a whole number from 1 to ${MAX_WEEKS}.` });
start.dataValidations.add('C9', { type: 'whole', operator: 'between', formulae: [1, WORKOUT_SHEETS], allowBlank: true, showErrorMessage: true, error: `Enter a whole number from 1 to ${WORKOUT_SHEETS}.` });
start.addConditionalFormatting({
  ref: 'D4:D10',
  rules: [
    { type: 'expression', priority: 1, formulae: ['LEFT(D4,1)="⚠"'], style: { font: { bold: true, color: { argb: C.redInk } } } },
    { type: 'expression', priority: 2, formulae: ['LEFT(D4,1)="✓"'], style: { font: { color: { argb: C.greenInk } } } },
  ],
});

// Sheet checklist
const CHECK_HEAD = 12;
start.getCell(`B${CHECK_HEAD - 1}`).value = 'SHEETS TO FILL OUT';
start.getCell(`B${CHECK_HEAD - 1}`).font = font({ bold: true, color: { argb: C.grey } });
start.getRow(CHECK_HEAD).values = [null, 'Sheet', 'Status', 'Problems'];
styleHeaderRow(start.getRow(CHECK_HEAD), 2, 4);
const statusText = (sheet) => `IF('${sheet}'!$O$1="FILL","FILL OUT",IF('${sheet}'!$O$1="SKIP","NOT NEEDED","Answer question 1"))`;
let r = CHECK_HEAD + 1;
const checklistRows = [];
for (let n = 1; n <= WORKOUT_SHEETS; n++, r++) {
  start.getCell(`B${r}`).value = `Workout ${n}`;
  start.getCell(`C${r}`).value = { formula: statusText(`Workout ${n}`) };
  start.getCell(`D${r}`).value = { formula: `IF('Workout ${n}'!$O$2=0,"",'Workout ${n}'!$O$2&" — look for ⚠ in the Check column")` };
  checklistRows.push(r);
}
start.getCell(`B${r}`).value = 'Schedule';
start.getCell(`C${r}`).value = { formula: statusText('Schedule') };
start.getCell(`D${r}`).value = { formula: `IF(Schedule!$O$2=0,"",Schedule!$O$2&" — look for ⚠ in the Check column")` };
checklistRows.push(r); r++;
start.getCell(`B${r}`).value = 'Exercise Library';
start.getCell(`C${r}`).value = 'REFERENCE';
start.getCell(`D${r}`).value = 'Look up exercises — no need to edit';
const CHECK_LAST = r;
for (let i = CHECK_HEAD + 1; i <= CHECK_LAST; i++) {
  for (const col of ['B', 'C', 'D']) {
    const cell = start.getCell(`${col}${i}`);
    cell.border = box;
    cell.font = font(col === 'C' ? { bold: true } : {});
    cell.alignment = { vertical: 'middle', horizontal: col === 'C' ? 'center' : 'left' };
  }
}
start.addConditionalFormatting({
  ref: `B${CHECK_HEAD + 1}:C${CHECK_LAST}`,
  rules: [
    { type: 'expression', priority: 1, formulae: [`$C${CHECK_HEAD + 1}="FILL OUT"`], style: { fill: fill(C.green), font: { bold: true, color: { argb: C.greenInk } } } },
    { type: 'expression', priority: 2, formulae: [`$C${CHECK_HEAD + 1}="NOT NEEDED"`], style: { fill: fill(C.red), font: { color: { argb: C.redInk } } } },
    { type: 'expression', priority: 3, formulae: [`$C${CHECK_HEAD + 1}="REFERENCE"`], style: { fill: fill(C.muted), font: { color: { argb: C.grey } } } },
  ],
});
start.addConditionalFormatting({
  ref: `D${CHECK_HEAD + 1}:D${CHECK_LAST}`,
  rules: [{ type: 'expression', priority: 1, formulae: [`D${CHECK_HEAD + 1}<>""`], style: { font: { bold: true, color: { argb: C.redInk } } } }],
});

// Overall readiness
const READY = CHECK_LAST + 2;
start.getCell(`B${READY}`).value = 'READY TO UPLOAD?';
start.getCell(`B${READY}`).font = font({ bold: true, size: 12 });
start.mergeCells(`C${READY}:D${READY}`);
const problemSum = [
  ...Array.from({ length: WORKOUT_SHEETS }, (_, i) => `'Workout ${i + 1}'!$O$2`),
  'Schedule!$O$2', 'COUNTIF($D$4:$D$10,"⚠*")',
].join('+');
start.getCell(`C${READY}`).value = { formula: `IF($C$4="","Answer question 1 first",IF((${problemSum})=0,"✓ Ready to upload","⚠ "&(${problemSum})&" problem(s) to fix — see the list above"))` };
start.getCell(`C${READY}`).font = font({ bold: true, size: 12 });
start.getCell(`C${READY}`).alignment = { horizontal: 'center', vertical: 'middle' };
start.getRow(READY).height = 26;
start.addConditionalFormatting({
  ref: `C${READY}:D${READY}`,
  rules: [
    { type: 'expression', priority: 1, formulae: [`LEFT($C$${READY},1)="✓"`], style: { fill: fill(C.green), font: { bold: true, color: { argb: C.greenInk } } } },
    { type: 'expression', priority: 2, formulae: [`LEFT($C$${READY},1)="⚠"`], style: { fill: fill(C.red), font: { bold: true, color: { argb: C.redInk } } } },
    { type: 'expression', priority: 3, formulae: [`$C$4=""`], style: { fill: fill(C.amber), font: { bold: true, color: { argb: C.amberInk } } } },
  ],
});

// How it works
const HOW = [
  'HOW IT WORKS',
  '1. Answer the questions above. The list of sheets turns GREEN for sheets you need to fill out and RED for sheets you can skip.',
  '2. Each green Workout sheet looks like a workout in the app: name the workout, then fill one exercise card per exercise, top to bottom (15 cards).',
  '3. Pick the exercise from the library dropdown on the dark bar (type to search) so clients get the demo video. Not in the library? Leave it blank and type it in “or Custom” with a muscle group.',
  '4. Under the exercise, fill one row per set (up to 8): Type, Goal Wt and Goal Reps become the goal columns clients see in the app. Goal Wt is in lbs; blank = bodyweight. Type blank = Regular.',
  '5. Mix set types freely, e.g. sets 1–2 Warm Up, sets 3–5 Regular, set 6 Drop Set.',
  '6. Supersets: give the exercises the same Superset letter (A, B, …). They are paired in the order listed (A1, A2, …).',
  '7. Section titles (“Warm-Up”, “Finisher”…): type them in “Section” above the first exercise of that section.',
  '8. Program: on the Schedule sheet pick a workout or REST for each of the 7 days, for every week. Tip: fill Week 1, then copy it down.',
  '9. Fix anything marked ⚠, check READY TO UPLOAD above, then upload the file in Trainer Central.',
  'Google Sheets: File → Import, or upload to Drive and open with Google Sheets. Download as .xlsx before uploading to RepLab.',
];
let h = READY + 2;
HOW.forEach((line, i) => {
  start.mergeCells(`B${h}:D${h}`);
  const cell = start.getCell(`B${h}`);
  cell.value = line;
  cell.font = i === 0 ? font({ bold: true, color: { argb: C.grey } }) : font();
  cell.alignment = { wrapText: true, vertical: 'top' };
  start.getRow(h).height = i === 0 ? 18 : 30;
  h++;
});

// ----- Workout sheets: one "card" per exercise, laid out like the workout session -----
// Card rows (k = cardTop(n)):
//   k+0  Section header (optional) + section notes        — sits above the card, like the app
//   k+1  EXERCISE n  | Library exercise (dropdown, C:F)   | G = card check
//   k+2  or Custom   | custom name (C:D) | muscle group (E)
//   k+3  Superset    | letter (C)        | Notes (E:F)
//   k+4  Set | Type | Goal Wt (lbs) | Goal Reps | Rep Range   (column titles)
//   k+5…k+4+SETS_PER_CARD   one row per set
//   then one blank spacer row
// Hidden helpers: P(k+1) = superset letter (for counting), Q(k+5…) = 1 when a set row has
// data but no Goal Reps.
workouts.forEach((ws, i) => {
  const n = i + 1;
  ws.columns = [
    { width: 2 }, { width: 13 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 40 },
  ];
  for (const col of [14, 15, 16, 17]) ws.getColumn(col).hidden = true; // N–Q helpers

  // Status (O1 = FILL / SKIP / "" ; O2 = problem count)
  ws.getCell('O1').value = { formula: n === 1
    ? `IF(Start!$C$4="Single Workout","FILL",IF(Start!$C$4="Program",IF(${n}<=N(Start!$C$9),"FILL","SKIP"),""))`
    : `IF(Start!$C$4="Single Workout","SKIP",IF(Start!$C$4="Program",IF(${n}<=N(Start!$C$9),"FILL","SKIP"),""))` };
  ws.getCell('O2').value = { formula: `IF($O$1="FILL",COUNTIF($G$3:$G$${LAST_ROW},"⚠*"),0)` };

  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = { formula: `IF($O$1="FILL","✅  FILL OUT THIS SHEET — Workout ${n}",IF($O$1="SKIP","⛔  NOT NEEDED — leave this sheet blank","Start on the Start sheet: answer question 1 first"))` };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('A1').font = font({ size: 14, bold: true });
  ws.getRow(1).height = 30;
  bannerRules(ws, 'A1:G1');

  ws.getCell('B3').value = 'WORKOUT NAME';
  ws.getCell('B3').font = font({ bold: true, size: 9, color: { argb: C.grey } });
  ws.mergeCells('C3:F3');
  inputCell(ws.getCell('C3'));
  ws.getCell('C3').font = font({ size: 14, bold: true });
  ws.getRow(3).height = 26;
  ws.dataValidations.add('C3', { type: 'textLength', operator: 'lessThanOrEqual', formulae: [200], allowBlank: true, showErrorMessage: true, error: '200 characters or fewer.' });
  ws.getCell('G3').value = { formula: `IF($O$1<>"FILL","",IF($C$3="","⚠ Name this workout",IF($C$3="REST","⚠ REST is reserved for rest days — pick another name",IF(COUNTIF(Lists!$A$3:$A$${WORKOUT_SHEETS + 2},$C$3)>1,"⚠ Another workout has this name",IF(COUNTA(${Array.from({ length: CARDS }, (_, c) => `$C$${cardTop(c + 1) + 1},$C$${cardTop(c + 1) + 2}`).join(',')})=0,"⚠ Add at least one exercise","✓ Looks good")))))` };
  ws.getCell('G3').font = font({ bold: true });
  ws.getCell('B4').value = 'WORKOUT NOTES';
  ws.getCell('B4').font = font({ bold: true, size: 9, color: { argb: C.grey } });
  ws.mergeCells('C4:F4');
  inputCell(ws.getCell('C4'));
  ws.getRow(4).height = 30;

  for (let c = 1; c <= CARDS; c++) {
    const k = cardTop(c);
    const label = (cell, text) => { cell.value = text; cell.font = font({ bold: true, size: 9, color: { argb: C.grey } }); cell.alignment = { vertical: 'middle' }; };

    // k+0 section header (optional)
    label(ws.getCell(`B${k}`), 'Section (optional)');
    ws.mergeCells(`C${k}:D${k}`);
    inputCell(ws.getCell(`C${k}`));
    ws.getCell(`C${k}`).font = font({ bold: true });
    ws.mergeCells(`E${k}:F${k}`);
    inputCell(ws.getCell(`E${k}`));
    ws.getCell(`C${k}`).note = 'Optional. A section title shown above this exercise in the app, e.g. "Warm-Up" or "Finisher". Leave blank if this exercise continues the section above.';
    ws.getCell(`E${k}`).note = 'Optional notes for the section.';

    // k+1 exercise band
    const band = ws.getRow(k + 1);
    band.height = 24;
    for (let col = 2; col <= 6; col++) { band.getCell(col).fill = fill(C.dark); band.getCell(col).border = box; }
    band.getCell(2).value = `EXERCISE ${c}`;
    band.getCell(2).font = font({ bold: true, color: { argb: C.white } });
    band.getCell(2).alignment = { vertical: 'middle' };
    ws.mergeCells(`C${k + 1}:F${k + 1}`);
    const ex = ws.getCell(`C${k + 1}`);
    ex.fill = fill(C.input);
    ex.font = font({ size: 12, bold: true });
    ex.alignment = { vertical: 'middle' };
    ws.dataValidations.add(`C${k + 1}`, list(null, LIB('B'), 'Pick from the RepLab exercise library (type to search). Library exercises come with demo videos.'));

    // k+2 custom exercise
    label(ws.getCell(`B${k + 2}`), 'or Custom');
    ws.mergeCells(`C${k + 2}:D${k + 2}`);
    inputCell(ws.getCell(`C${k + 2}`));
    ws.getCell(`C${k + 2}`).note = 'Only if the exercise is not in the library. Leave the library box above blank and pick a muscle group to the right.';
    inputCell(ws.getCell(`E${k + 2}`));
    ws.getCell(`E${k + 2}`).note = 'Muscle group — required for a custom exercise.';
    ws.dataValidations.add(`C${k + 2}`, { type: 'textLength', operator: 'lessThanOrEqual', formulae: [200], allowBlank: true, showErrorMessage: true, error: '200 characters or fewer.' });
    ws.dataValidations.add(`E${k + 2}`, list(null, LIST_MUSCLES, 'Muscle group for the custom exercise'));
    label(ws.getCell(`F${k + 2}`), '← muscle group');

    // k+3 superset + notes
    label(ws.getCell(`B${k + 3}`), 'Superset');
    inputCell(ws.getCell(`C${k + 3}`));
    ws.getCell(`C${k + 3}`).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(`C${k + 3}`).note = 'Optional. Give exercises the same letter (A, B, …) to superset them. Paired in the order listed (A1, A2, …).';
    ws.dataValidations.add(`C${k + 3}`, list(null, LIST_SUPERSET, 'Same letter = same superset'));
    label(ws.getCell(`D${k + 3}`), 'Coach notes');
    ws.mergeCells(`E${k + 3}:F${k + 3}`);
    inputCell(ws.getCell(`E${k + 3}`));
    ws.getCell(`E${k + 3}`).note = 'Optional cues for the client: tempo, rest, form.';
    ws.getRow(k + 3).height = 22;

    // k+4 set column titles
    const titles = ws.getRow(k + 4);
    ['Set', 'Type', 'Goal Wt (lbs)', 'Goal Reps', 'Rep Range'].forEach((t, j) => {
      const cell = titles.getCell(j + 2);
      cell.value = t;
      cell.font = font({ bold: true, size: 8, color: { argb: C.grey } });
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = fill(C.muted);
      cell.border = box;
    });
    titles.getCell(3).note = 'Blank = Regular (or Super Set when a superset letter is set).';
    titles.getCell(4).note = 'Optional goal weight. Blank = bodyweight / client chooses.';
    titles.getCell(5).note = 'Goal reps for this set. A set row counts once Goal Reps is filled in.';
    titles.getCell(6).note = 'Optional, e.g. 8-12.';

    // set rows
    const s0 = k + 5;
    const s1 = k + 4 + SETS_PER_CARD;
    for (let s = s0; s <= s1; s++) {
      const R = ws.getRow(s);
      R.getCell(2).value = s - s0 + 1;
      R.getCell(2).font = font({ bold: true, color: { argb: C.grey } });
      R.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      R.getCell(2).border = box;
      for (let col = 3; col <= 6; col++) {
        inputCell(R.getCell(col));
        R.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      ws.getCell(`Q${s}`).value = { formula: `IF(AND($E${s}="",COUNTA($C${s}:$D${s},$F${s})>0),1,0)` };
    }
    ws.dataValidations.add(`C${s0}:C${s1}`, list(null, LIST_SET_TYPES, null));
    ws.dataValidations.add(`D${s0}:D${s1}`, { type: 'decimal', operator: 'between', formulae: [0, 2000], allowBlank: true, showErrorMessage: true, error: 'Goal weight: a number from 0 to 2000 (lbs).' });
    ws.dataValidations.add(`E${s0}:E${s1}`, { type: 'whole', operator: 'between', formulae: [0, 100], allowBlank: true, showErrorMessage: true, error: 'Goal reps: a whole number from 0 to 100.' });
    ws.dataValidations.add(`F${s0}:F${s1}`, { type: 'textLength', operator: 'lessThanOrEqual', formulae: [20], allowBlank: true, showErrorMessage: true, error: 'Keep the rep range short, e.g. 8-12.' });

    // Card check (G, on the exercise band)
    const lib = `$C$${k + 1}`, custom = `$C$${k + 2}`, group = `$E$${k + 2}`, ss = `$C$${k + 3}`;
    const sets = `$E$${s0}:$E$${s1}`;
    const anyInput = `COUNTA($C$${k}:$F$${k},$E$${k + 3},$C$${s0}:$F$${s1})+COUNTA(${group},${ss})`;
    const lookup = `MATCH(${lib},${LIB('B')},0)`;
    ws.getCell(`P${k + 1}`).value = { formula: `IF(OR(${lib}<>"",${custom}<>""),${ss},"")` };
    const supersetCount = `COUNTIF($P$${cardTop(1) + 1}:$P$${LAST_ROW},${ss})`;
    ws.getCell(`G${k + 1}`).value = { formula:
      `IF(AND(${lib}="",${custom}=""),IF(${anyInput}>0,"⚠ Pick an exercise for this card",""),` +
      `IF(AND(${lib}<>"",${custom}<>""),"⚠ Use the library OR a custom exercise, not both",` +
      `IF(AND(${custom}<>"",${group}=""),"⚠ Pick a muscle group for the custom exercise",` +
      `IF(COUNT(${sets})=0,"⚠ Enter Goal Reps for at least one set",` +
      `IF(SUM($Q$${s0}:$Q$${s1})>0,"⚠ A set is missing Goal Reps",` +
      `IF(IF(${ss}="",1=0,${supersetCount}<2),"⚠ Superset "&${ss}&" needs 2+ exercises",` +
      `IF(${lib}<>"",IFERROR("✓ "&INDEX(${LIB('C')},${lookup})&IF(INDEX(${LIB('D')},${lookup})="Yes"," · demo video","")&" · "&COUNT(${sets})&" sets","⚠ Not in the library — use Custom"),` +
      `"✓ Custom ("&${group}&") · "&COUNT(${sets})&" sets")))))))` };
    ws.getCell(`G${k + 1}`).font = font({ bold: true });
    ws.getCell(`G${k + 1}`).alignment = { vertical: 'middle', wrapText: true };
  }

  ws.addConditionalFormatting({
    ref: `G3:G${LAST_ROW}`,
    rules: [
      { type: 'expression', priority: 1, formulae: ['LEFT(G3,1)="⚠"'], style: { fill: fill(C.red), font: { bold: true, color: { argb: C.redInk } } } },
      { type: 'expression', priority: 2, formulae: ['LEFT(G3,1)="✓"'], style: { font: { color: { argb: C.greenInk } } } },
    ],
  });
  // Greyed out when this sheet isn't needed.
  ws.addConditionalFormatting({
    ref: `C3:F${LAST_ROW}`,
    rules: [{ type: 'expression', priority: 1, formulae: ['$O$1="SKIP"'], style: { fill: fill(C.muted), font: { color: { argb: 'FFAAAAAA' } } } }],
  });
});

// ----- Schedule -----
sched.columns = [{ width: 10 }, ...Array.from({ length: 7 }, () => ({ width: 16 })), { width: 40 }];
hideHelperColumns(sched);
sched.getCell('O1').value = { formula: 'IF(Start!$C$4="Program","FILL",IF(Start!$C$4="Single Workout","SKIP",""))' };
sched.getCell('P1').value = { formula: 'IF(Start!$C$4="Program",N(Start!$C$8),0)' };
sched.getCell('O2').value = { formula: `IF($O$1="FILL",COUNTIF($I$6:$I$${MAX_WEEKS + 5},"⚠*"),0)` };
sched.mergeCells('A1:I1');
sched.getCell('A1').value = { formula: 'IF($O$1="FILL","✅  FILL OUT THIS SHEET — weeks 1 to "&$P$1,IF($O$1="SKIP","⛔  NOT NEEDED for a single workout","Start on the Start sheet: answer question 1 first"))' };
sched.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
sched.getCell('A1').font = font({ size: 14, bold: true });
sched.getRow(1).height = 30;
bannerRules(sched, 'A1:I1');
sched.mergeCells('A3:I3');
sched.getCell('A3').value = 'For each week, pick a workout (by the name you gave it) or REST for all 7 days. Day 1 is the day the client starts the program. Tip: fill Week 1, then copy it down.';
sched.getCell('A3').font = font({ italic: true, color: { argb: C.grey } });
sched.getCell('A3').alignment = { wrapText: true };
sched.getRow(3).height = 30;
sched.getRow(5).values = ['Week', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Check'];
styleHeaderRow(sched.getRow(5), 1, 9);
for (let w = 1; w <= MAX_WEEKS; w++) {
  const row = w + 5;
  const R = sched.getRow(row);
  R.getCell(1).value = w;
  R.getCell(1).numFmt = '"Week "0';
  R.getCell(1).font = font({ bold: true });
  for (let c = 2; c <= 8; c++) { inputCell(R.getCell(c)); R.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' }; }
  R.getCell(9).value = { formula:
    `IF($O$1<>"FILL","",IF($A${row}>$P$1,IF(COUNTA($B${row}:$H${row})>0,"⚠ Past the program length — clear it or raise question 5",""),` +
    `IF(COUNTA($B${row}:$H${row})<7,"⚠ Fill all 7 days (use REST for rest days)",` +
    // One COUNTIF per day (no array formulas) so Excel and Google Sheets agree.
    `IF((${['B', 'C', 'D', 'E', 'F', 'G', 'H'].map((c) => `(COUNTIF(${LIST_WORKOUTS},$${c}${row})=0)`).join('+')})>0,"⚠ Unknown workout name — pick from the dropdown","✓"))))` };
  R.getCell(9).border = box;
  R.getCell(9).font = font();
}
const SCHED_LAST = MAX_WEEKS + 5;
sched.dataValidations.add(`B6:H${SCHED_LAST}`, list(`B6:H${SCHED_LAST}`, LIST_WORKOUTS, null));
sched.addConditionalFormatting({
  ref: `A6:H${SCHED_LAST}`,
  rules: [
    { type: 'expression', priority: 1, formulae: ['OR($O$1<>"FILL",$A6>$P$1)'], style: { fill: fill(C.muted), font: { color: { argb: 'FFAAAAAA' } } } },
    { type: 'expression', priority: 2, formulae: ['A6="REST"'], style: { fill: fill(C.rest), font: { color: { argb: 'FF1E4E8C' } } } },
  ],
});
sched.addConditionalFormatting({
  ref: `I6:I${SCHED_LAST}`,
  rules: [
    { type: 'expression', priority: 1, formulae: ['LEFT(I6,1)="⚠"'], style: { fill: fill(C.red), font: { bold: true, color: { argb: C.redInk } } } },
    { type: 'expression', priority: 2, formulae: ['LEFT(I6,1)="✓"'], style: { font: { color: { argb: C.greenInk } } } },
  ],
});

// Any formula error in a Check cell shows as a ⚠ problem (so READY TO UPLOAD can't
// say ✓ while a check is broken).
const wrapCheck = (cell) => {
  if (cell.value && cell.value.formula) cell.value = { formula: `IFERROR(${cell.value.formula},"⚠ Check this row")` };
};
workouts.forEach((ws) => { wrapCheck(ws.getCell('G3')); for (let c = 1; c <= CARDS; c++) wrapCheck(ws.getCell(`G${cardTop(c) + 1}`)); });
for (let row = 6; row <= SCHED_LAST; row++) wrapCheck(sched.getCell(`I${row}`));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
await wb.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath} (${exercises.length} library exercises, ${muscleGroups.length} muscle groups)`);
