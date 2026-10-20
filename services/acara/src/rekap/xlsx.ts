import ExcelJS from 'exceljs';
import type { RekapService } from './rekap.service.js';
import type { Ringkasan, StatusRekap } from './rekap.js';

type SesiRekap = Awaited<ReturnType<RekapService['sesiRekap']>>;
type AcaraRekap = Awaited<ReturnType<RekapService['acaraRekap']>>;

const WARNA: Record<StatusRekap, string> = {
  HADIR: 'FFD1FAE5',
  IZIN: 'FFDBEAFE',
  SAKIT: 'FFFEF3C7',
  ALPHA: 'FFFEE2E2',
};
const KUNING = 'FFFEF08A';
const SINGKAT: Record<StatusRekap, string> = { HADIR: 'H', IZIN: 'I', SAKIT: 'S', ALPHA: 'A' };
const METODE: Record<string, string> = { WAJAH: 'Wajah', MANUAL: 'Cari nama', TAMU: 'Tamu' };

const fill = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb },
});

const waktuWib = (d: Date) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d);

function judul(ws: ExcelJS.Worksheet, baris: string[]): void {
  baris.forEach((t, i) => {
    const r = ws.addRow([t]);
    r.font = i === 0 ? { bold: true, size: 14 } : { color: { argb: 'FF555555' } };
  });
  ws.addRow([]);
}

function header(ws: ExcelJS.Worksheet, cols: string[]): void {
  const r = ws.addRow(cols);
  r.font = { bold: true };
  r.eachCell((c) => {
    c.fill = fill('FFE5E7EB');
    c.border = { bottom: { style: 'thin' } };
  });
  ws.views = [{ state: 'frozen', ySplit: r.number }];
}

function sheetRingkas(
  wb: ExcelJS.Workbook,
  nama: string,
  rows: (Ringkasan & { nama: string })[],
  total: Ringkasan,
): void {
  const ws = wb.addWorksheet(nama);
  header(ws, [
    nama === 'Per desa' ? 'Desa' : 'Kelompok',
    'Peserta',
    'Hadir',
    'Izin',
    'Sakit',
    'Alpha',
    'Terlambat',
    '% Hadir',
  ]);
  for (const r of [...rows, { ...total, nama: 'Total' }]) {
    const row = ws.addRow([
      r.nama,
      r.peserta,
      r.HADIR,
      r.IZIN,
      r.SAKIT,
      r.ALPHA,
      r.terlambat,
      r.persenHadir / 100,
    ]);
    row.getCell(8).numFmt = '0.0%';
    if (r.nama === 'Total') row.font = { bold: true };
  }
  ws.getColumn(1).width = 28;
  for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 11;
}

/** Rekap satu sesi: daftar peserta + ringkasan per kelompok & desa. */
export async function rekapSesiXlsx(r: SesiRekap, wilayah: string | null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Platform Acara';
  const ws = wb.addWorksheet('Rekap');
  const k = r.ringkas;
  judul(ws, [
    `Rekap ${r.acara.nama} — ${r.sesi.nama}`,
    `${waktuWib(r.sesi.mulai)}${wilayah ? ` · ${wilayah}` : ''}`,
    r.final
      ? `Final (sesi ditutup ${waktuWib(r.sesi.ditutupAt!)})`
      : 'Sementara (sesi belum ditutup)',
    `Peserta ${k.peserta} · Hadir ${k.HADIR} (${k.persenHadir}%) · Izin ${k.IZIN} · Sakit ${k.SAKIT} · Alpha ${k.ALPHA} · Terlambat ${k.terlambat}`,
  ]);
  header(ws, [
    'No',
    'Kode',
    'Nama',
    'L/P',
    'Kelompok',
    'Desa',
    'Status',
    'Terlambat',
    'Waktu hadir',
    'Cara',
    'Pintu',
    'Catatan',
  ]);
  r.items.forEach((x, i) => {
    const catatan = [
      x.wajahPending && 'Wajah belum diverifikasi',
      x.perluTinjau && 'Perlu ditinjau',
      x.susulan && 'Dicatat admin',
    ].filter(Boolean);
    const row = ws.addRow([
      i + 1,
      x.anggota.kode,
      x.anggota.nama,
      x.anggota.jenisKelamin === 'P' ? 'P' : 'L',
      x.anggota.kelompok.nama,
      x.anggota.desa.nama,
      x.status,
      x.terlambat ? 'Ya' : '',
      x.waktu ? waktuWib(x.waktu) : '',
      x.susulan ? 'Susulan' : x.metode ? (METODE[x.metode] ?? x.metode) : '',
      x.pintu ?? '',
      catatan.join(', '),
    ]);
    row.getCell(7).fill = fill(WARNA[x.status]);
    if (x.wajahPending) row.getCell(12).fill = fill(KUNING);
  });
  [5, 12, 30, 5, 22, 22, 9, 10, 20, 11, 10, 28].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: 12 } };
  sheetRingkas(wb, 'Per kelompok', r.perKelompok, k);
  sheetRingkas(wb, 'Per desa', r.perDesa, k);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Rekap acara: matriks anggota × sesi (H/I/S/A) + ringkasan per kelompok. */
export async function rekapAcaraXlsx(r: AcaraRekap, wilayah: string | null): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Platform Acara';
  const ws = wb.addWorksheet('Rekap');
  const k = r.ringkas;
  judul(ws, [
    `Rekap ${r.acara.nama}`,
    `${r.sesi.length} sesi${wilayah ? ` · ${wilayah}` : ''} · H = hadir, I = izin, S = sakit, A = alpha`,
    `Kehadiran ${k.persenHadir}% (${k.HADIR} dari ${k.peserta} kehadiran peserta)`,
  ]);
  header(ws, [
    'No',
    'Kode',
    'Nama',
    'Kelompok',
    'Desa',
    ...r.sesi.map((s) => `${s.nama}${s.final ? '' : ' *'}`),
    'H',
    'I',
    'S',
    'A',
    '% Hadir',
  ]);
  const n = r.sesi.length;
  r.anggota.forEach((a, i) => {
    const row = ws.addRow([
      i + 1,
      a.anggota.kode,
      a.anggota.nama,
      a.anggota.kelompok.nama,
      a.anggota.desa.nama,
      ...a.status.map((s) => (s ? SINGKAT[s] : '')),
      a.ringkas.HADIR,
      a.ringkas.IZIN,
      a.ringkas.SAKIT,
      a.ringkas.ALPHA,
      a.ringkas.persenHadir / 100,
    ]);
    a.status.forEach((s, j) => {
      if (!s) return;
      const c = row.getCell(6 + j);
      c.fill = fill(WARNA[s]);
      c.alignment = { horizontal: 'center' };
    });
    row.getCell(10 + n).numFmt = '0.0%';
  });
  [5, 12, 30, 22, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let c = 6; c < 6 + n; c++) ws.getColumn(c).width = 14;
  if (r.sesi.some((s) => !s.final)) {
    ws.addRow([]);
    ws.addRow(['* sesi belum ditutup; status masih sementara']).font = { italic: true };
  }
  sheetRingkas(wb, 'Per kelompok', r.perKelompok, k);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
