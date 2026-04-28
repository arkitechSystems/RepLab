const XLSX = require('xlsx');
const path = require('path');

const file = process.argv[2];
const wb = XLSX.readFile(file);
console.log('=== FILE:', path.basename(file), '===');
console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n--- Sheet: ${name} (${rows.length} rows) ---`);
  rows.forEach((r, i) => {
    const filled = r.some(c => c !== '' && c != null);
    if (filled) console.log(i, JSON.stringify(r));
  });
}
