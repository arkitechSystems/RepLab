import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { rowsToXlsxBuffer } from '../xlsxExport.js';

async function read(buf) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}
const values = (ws) => ws.getSheetValues().slice(1).map((r) => (r || []).slice(1));

describe('rowsToXlsxBuffer', () => {
  it('writes one sheet per entry with a header row from the keys', async () => {
    const buf = await rowsToXlsxBuffer([
      { name: 'Users', rows: [{ id: 1, name: 'A' }, { id: 2, name: 'B', extra: true }] },
      { name: 'Empty', rows: [] },
    ]);
    const wb = await read(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Users', 'Empty']);
    expect(values(wb.getWorksheet('Users'))).toEqual([
      ['id', 'name', 'extra'],
      [1, 'A'],
      [2, 'B', true],
    ]);
  });

  it('keeps an explicit header order, widths and frozen header', async () => {
    const buf = await rowsToXlsxBuffer([
      { name: 'Ex', rows: [{ b: 2, a: 1 }], header: ['a', 'b'], widths: [6, 40], freezeHeader: true },
    ]);
    const ws = (await read(buf)).getWorksheet('Ex');
    expect(values(ws)).toEqual([['a', 'b'], [1, 2]]);
    expect(ws.getColumn(2).width).toBe(40);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('turns database values into cells: nulls blank, dates kept, arrays and JSON as text', async () => {
    const when = new Date('2026-10-11T12:00:00Z');
    const long = 'x'.repeat(40000);
    const buf = await rowsToXlsxBuffer([{ name: 'S', rows: [
      { n: null, d: when, tags: ['push', 'chest'], data: { sets: 3 }, big: 12n, long },
    ] }]);
    const row = (await read(buf)).getWorksheet('S').getRow(2);
    expect(row.getCell(1).value).toBe(null);
    expect(new Date(row.getCell(2).value).toISOString()).toBe(when.toISOString());
    expect(row.getCell(3).value).toBe('["push","chest"]');
    expect(row.getCell(4).value).toBe('{"sets":3}');
    expect(row.getCell(5).value).toBe('12');
    expect(row.getCell(6).value.length).toBe(32767);
  });
});
