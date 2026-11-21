// Builds .xlsx downloads from arrays of plain row objects (the admin exports).
// Replaces the abandoned `xlsx` 0.18 package (known security issues, no fix on npm)
// with exceljs. Same behavior as xlsx's json_to_sheet: one column per key, in the
// order keys first appear, header row of key names.
import ExcelJS from 'exceljs';

const MAX_CELL_CHARS = 32767; // Excel's per-cell limit

function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return v.toString();
  const s = typeof v === 'string' ? v : JSON.stringify(v); // arrays / JSON columns
  return s.length > MAX_CELL_CHARS ? s.slice(0, MAX_CELL_CHARS) : s;
}

function headerFor(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows) {
    for (const k of Object.keys(row || {})) {
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    }
  }
  return keys;
}

/**
 * @param {Array<{name: string, rows: object[], header?: string[], widths?: number[], freezeHeader?: boolean}>} sheets
 * @returns {Promise<Buffer>}
 */
export async function rowsToXlsxBuffer(sheets) {
  const wb = new ExcelJS.Workbook();
  for (const { name, rows, header, widths, freezeHeader } of sheets) {
    const ws = wb.addWorksheet(name, freezeHeader ? { views: [{ state: 'frozen', ySplit: 1 }] } : {});
    const keys = header || headerFor(rows);
    ws.addRow(keys);
    for (const row of rows) ws.addRow(keys.map((k) => cellValue(row?.[k])));
    if (widths) widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
