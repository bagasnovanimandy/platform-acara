import { KATEGORI_GENERUS, KATEGORI_GENERUS_LABEL } from '@platform-acara/shared';
import ExcelJS from 'exceljs';
import { badRequest } from '../common/app-error.js';
import {
  type CellValue,
  IMPORT_COLUMNS,
  type ImportColumn,
  isEmptyRow,
  normalizeName,
  type RawRow,
} from './import.js';

export const MAX_IMPORT_ROWS = 5000;

function cellValue(v: ExcelJS.CellValue): CellValue {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number' || v instanceof Date) return v;
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v && typeof v.text === 'string') return v.text; // hyperlink
    if ('result' in v) return cellValue(v.result as ExcelJS.CellValue); // formula
    if ('error' in v) return null;
  }
  return null;
}

/** Baca sheet pertama: baris 1 = header (urutan bebas), baris berikutnya = data. */
export async function readImportXlsx(
  buffer: Buffer,
): Promise<{ rows: RawRow[]; firstRow: number }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw badRequest('FILE_INVALID', 'File bukan .xlsx yang valid');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw badRequest('FILE_INVALID', 'File tidak berisi sheet');

  const byName = new Map(IMPORT_COLUMNS.map((c) => [normalizeName(c), c] as const));
  const columns = new Map<number, ImportColumn>();
  ws.getRow(1).eachCell((cell, col) => {
    const name = byName.get(normalizeName(String(cellValue(cell.value) ?? '')));
    if (name) columns.set(col, name);
  });
  const missing = IMPORT_COLUMNS.filter((c) => ![...columns.values()].includes(c));
  if (missing.includes('Nama') || missing.includes('Kelompok')) {
    throw badRequest('HEADER_INVALID', 'Header kolom tidak sesuai template', {
      kolomHilang: missing,
    });
  }

  const rows: RawRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const raw: RawRow = {};
    for (const [col, name] of columns) raw[name] = cellValue(row.getCell(col).value);
    rows.push(raw);
  }
  // Buang baris kosong di akhir (sering ada karena format sel).
  while (rows.length && isEmptyRow(rows[rows.length - 1]!)) rows.pop();
  if (rows.length > MAX_IMPORT_ROWS) {
    throw badRequest('TOO_MANY_ROWS', `Maksimal ${MAX_IMPORT_ROWS} baris per import`);
  }
  return { rows, firstRow: 2 };
}

export async function importTemplateXlsx(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Anggota');
  ws.addRow([...IMPORT_COLUMNS]);
  ws.addRow([
    'Ahmad Fauzi',
    'L',
    '05/03/2010',
    'Pra-remaja',
    '081234567890',
    '081300001111',
    'Budi Santoso',
    'Nama Kelompok',
    'Nama Desa',
    'Nama Daerah',
  ]);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 18));
  // Simpan tanggal & nomor sebagai teks agar Excel tidak mengubah 08… menjadi angka.
  for (const col of ['Tgl Lahir', 'No WA', 'No WA Ortu'] as const) {
    ws.getColumn(IMPORT_COLUMNS.indexOf(col) + 1).numFmt = '@';
  }
  // Pilihan kategori sebagai dropdown; boleh dikosongkan bila belum di-assessment.
  const kategoriCol = IMPORT_COLUMNS.indexOf('Kategori') + 1;
  const pilihan = KATEGORI_GENERUS.map((k) => KATEGORI_GENERUS_LABEL[k]).join(',');
  for (let r = 2; r <= 1000; r++) {
    ws.getRow(r).getCell(kategoriCol).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${pilihan}"`],
    };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
