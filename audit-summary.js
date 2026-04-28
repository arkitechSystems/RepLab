const XLSX = require('xlsx');
const path = require('path');
const file = process.argv[2];
const wb = XLSX.readFile(file);
console.log('=== FILE:', path.basename(file), '===');
console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n--- ${name} (${rows.length} rows) ---`);
  // print first 30 rows summary
  rows.slice(0, 40).forEach((r,i) => {
    if (r.some(c => c!=='' && c!=null)) console.log(i, JSON.stringify(r).slice(0,300));
  });
  if (rows.length > 40) console.log('... (' + (rows.length - 40) + ' more rows)');
}
