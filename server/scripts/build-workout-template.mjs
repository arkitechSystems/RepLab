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
const FIRST_ROW = 7;          // first exercise row on a Workout sheet
const ROWS = 50;              // exercise rows per Workout sheet
const LAST_ROW = FIRST_ROW + ROWS - 1;
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
  workouts.push(wb.addWorksheet(`Workout ${n}`, { properties: { tabColor: { argb: 'FF3A6EA5' } }, views: [{ state: 'frozen', ySplit: 6, showGridLines: false }] }));
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
  '2. On each green Workout sheet: give the workout a name, then add one row per exercise.',
  '3. Pick exercises from the Library dropdown (type to search) so clients get the demo video. Not in the library? Leave Library blank and type it in Custom Exercise with a muscle group.',
  '4. Sets, Goal Reps and Goal Weight become the goal columns clients see in the app. Goal Weight is in lbs; leave it blank for bodyweight.',
  '5. Different set types for one exercise (e.g. 2 warm-up sets, then 3 regular sets): use one row per set type, same exercise, one after another.',
  '6. Supersets: give the exercises the same Superset letter (A, B, …). They are paired in the order listed (A1, A2, …).',
  '7. Section headers ("Warm-Up", "Finisher"…): type the header in Section Header on its own row, above the exercises it covers. Coach Notes on that row become the section notes.',
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

// ----- Workout sheets -----
const WCOLS = [
  // [header, width, note]
  ['#', 5, null],
  ['Section Header', 18, 'Optional. Type a header ("Warm-Up", "Main Lifts") on its own row, above the exercises it covers. Leave the rest of the row blank except Coach Notes.'],
  ['Library Exercise', 34, 'Pick from the RepLab exercise library (type to search). Library exercises come with demo videos.'],
  ['Custom Exercise', 26, 'Only if the exercise is not in the library. Leave Library Exercise blank.'],
  ['Custom Muscle Group', 16, 'Required for a custom exercise.'],
  ['Superset', 10, 'Optional. Same letter = same superset (A, B, …). Paired in the order listed.'],
  ['Set Type', 15, 'Blank = Regular (or Super Set when a Superset letter is set).'],
  ['Sets', 7, 'Number of sets of this type (1–20).'],
  ['Goal Reps', 9, 'Goal reps per set.'],
  ['Rep Range', 10, 'Optional, e.g. 8-12.'],
  ['Goal Weight (lbs)', 11, 'Optional goal weight per set. Blank = bodyweight / client chooses.'],
  ['Coach Notes', 36, 'Optional cues for the client (tempo, rest, form). On a section header row: notes for that section.'],
  ['Check', 34, 'Automatic. Fix anything marked ⚠.'],
];
workouts.forEach((ws, i) => {
  const n = i + 1;
  ws.columns = WCOLS.map(([, width]) => ({ width }));
  hideHelperColumns(ws);

  // Status (O1 = FILL / SKIP / "" ; O2 = problem count)
  ws.getCell('O1').value = { formula: n === 1
    ? `IF(Start!$C$4="Single Workout","FILL",IF(Start!$C$4="Program",IF(${n}<=N(Start!$C$9),"FILL","SKIP"),""))`
    : `IF(Start!$C$4="Single Workout","SKIP",IF(Start!$C$4="Program",IF(${n}<=N(Start!$C$9),"FILL","SKIP"),""))` };
  ws.getCell('O2').value = { formula: `IF($O$1="FILL",COUNTIF($M$3:$M$${LAST_ROW},"⚠*"),0)` };

  ws.mergeCells('A1:M1');
  ws.getCell('A1').value = { formula: `IF($O$1="FILL","✅  FILL OUT THIS SHEET — Workout ${n}",IF($O$1="SKIP","⛔  NOT NEEDED — leave this sheet blank","Start on the Start sheet: answer question 1 first"))` };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getCell('A1').font = font({ size: 14, bold: true });
  ws.getRow(1).height = 30;
  bannerRules(ws, 'A1:M1');

  ws.getCell('B3').value = 'Workout name';
  ws.getCell('B3').font = font({ bold: true });
  ws.mergeCells('C3:E3');
  inputCell(ws.getCell('C3'));
  ws.dataValidations.add('C3', { type: 'textLength', operator: 'lessThanOrEqual', formulae: [200], allowBlank: true, showErrorMessage: true, error: '200 characters or fewer.' });
  ws.getCell('G3').value = 'Workout notes';
  ws.getCell('G3').font = font({ bold: true });
  ws.mergeCells('H3:L3');
  inputCell(ws.getCell('H3'));
  ws.getCell('M3').value = { formula: `IF($O$1<>"FILL","",IF($C$3="","⚠ Name this workout",IF($C$3="REST","⚠ REST is reserved for rest days — pick another name",IF(COUNTIF(Lists!$A$3:$A$${WORKOUT_SHEETS + 2},$C$3)>1,"⚠ Another workout has this name",IF(COUNTA($C$${FIRST_ROW}:$D$${LAST_ROW})=0,"⚠ Add at least one exercise","✓ Looks good")))))` };
  ws.getCell('M3').font = font({ bold: true });
  ws.getRow(3).height = 24;

  ws.mergeCells('B4:M4');
  ws.getCell('B4').value = 'One row per exercise (or per set type). Hover over a column title for help.';
  ws.getCell('B4').font = font({ italic: true, color: { argb: C.grey } });

  const head = ws.getRow(6);
  head.values = WCOLS.map(([title]) => title);
  styleHeaderRow(head, 1, 13);
  WCOLS.forEach(([, , note], c) => { if (note) head.getCell(c + 1).note = note; });

  for (let row = FIRST_ROW; row <= LAST_ROW; row++) {
    const R = ws.getRow(row);
    R.getCell(1).value = row - FIRST_ROW + 1;
    R.getCell(1).font = font({ color: { argb: C.grey } });
    R.getCell(1).alignment = { horizontal: 'center' };
    for (let c = 2; c <= 12; c++) inputCell(R.getCell(c));
    for (const c of [6, 8, 9, 10, 11]) R.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
    const lookup = `MATCH($C${row},${LIB('B')},0)`;
    R.getCell(13).value = { formula:
      `IF(AND($B${row}="",$C${row}="",$D${row}=""),IF(COUNTA($E${row}:$L${row})>0,"⚠ Pick an exercise",""),` +
      `IF($B${row}<>"",IF(COUNTA($C${row}:$K${row})>0,"⚠ Put the section header on its own row","§ Section header"),` +
      `IF(AND($C${row}<>"",$D${row}<>""),"⚠ Use Library OR Custom, not both",` +
      `IF(AND($D${row}<>"",$E${row}=""),"⚠ Pick a muscle group for the custom exercise",` +
      `IF(OR($H${row}="",$I${row}=""),"⚠ Enter Sets and Goal Reps",` +
      `IF(IF($F${row}="",1=0,COUNTIF($F$${FIRST_ROW}:$F$${LAST_ROW},$F${row})<2),"⚠ Superset "&$F${row}&" needs 2+ exercises",` +
      `IF($C${row}<>"",IFERROR("✓ "&INDEX(${LIB('C')},${lookup})&IF(INDEX(${LIB('D')},${lookup})="Yes"," · demo video",""),"⚠ Not in the library — use Custom Exercise"),` +
      `"✓ Custom ("&$E${row}&")")))))))` };
    R.getCell(13).font = font();
    R.getCell(13).border = box;
  }
  const rng = (col) => `${col}${FIRST_ROW}:${col}${LAST_ROW}`;
  ws.dataValidations.add(rng('C'), list(rng('C'), LIB('B'), null));
  ws.dataValidations.add(rng('D'), { type: 'textLength', operator: 'lessThanOrEqual', formulae: [200], allowBlank: true, showErrorMessage: true, error: '200 characters or fewer.' });
  ws.dataValidations.add(rng('E'), list(rng('E'), LIST_MUSCLES));
  ws.dataValidations.add(rng('F'), list(rng('F'), LIST_SUPERSET));
  ws.dataValidations.add(rng('G'), list(rng('G'), LIST_SET_TYPES));
  ws.dataValidations.add(rng('H'), { type: 'whole', operator: 'between', formulae: [1, 20], allowBlank: true, showErrorMessage: true, error: 'Sets: a whole number from 1 to 20.' });
  ws.dataValidations.add(rng('I'), { type: 'whole', operator: 'between', formulae: [0, 100], allowBlank: true, showErrorMessage: true, error: 'Goal reps: a whole number from 0 to 100.' });
  ws.dataValidations.add(rng('J'), { type: 'textLength', operator: 'lessThanOrEqual', formulae: [20], allowBlank: true, showErrorMessage: true, error: 'Keep the rep range short, e.g. 8-12.' });
  ws.dataValidations.add(rng('K'), { type: 'decimal', operator: 'between', formulae: [0, 2000], allowBlank: true, showErrorMessage: true, error: 'Goal weight: a number from 0 to 2000 (lbs).' });

  ws.addConditionalFormatting({
    ref: `A${FIRST_ROW}:L${LAST_ROW}`,
    rules: [
      { type: 'expression', priority: 1, formulae: ['$O$1="SKIP"'], style: { fill: fill(C.muted), font: { color: { argb: 'FFAAAAAA' } } } },
      { type: 'expression', priority: 2, formulae: [`$B${FIRST_ROW}<>""`], style: { fill: fill(C.section), font: { bold: true } } },
    ],
  });
  ws.addConditionalFormatting({
    ref: `M3:M${LAST_ROW}`,
    rules: [
      { type: 'expression', priority: 1, formulae: ['LEFT(M3,1)="⚠"'], style: { fill: fill(C.red), font: { bold: true, color: { argb: C.redInk } } } },
      { type: 'expression', priority: 2, formulae: ['LEFT(M3,1)="✓"'], style: { font: { color: { argb: C.greenInk } } } },
    ],
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
workouts.forEach((ws) => { for (let row = 3; row <= LAST_ROW; row++) if (row === 3 || row >= FIRST_ROW) wrapCheck(ws.getCell(`M${row}`)); });
for (let row = 6; row <= SCHED_LAST; row++) wrapCheck(sched.getCell(`I${row}`));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
await wb.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath} (${exercises.length} library exercises, ${muscleGroups.length} muscle groups)`);
