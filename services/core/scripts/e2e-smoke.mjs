/**
 * Uji asap end-to-end core-svc terhadap service yang sedang berjalan + data seed.
 * Jalankan: pnpm --filter @platform-acara/core db:seed && pnpm --filter @platform-acara/core test:e2e
 * Membuat data uji baru setiap kali (nama/nomor memakai timestamp), jadi aman diulang di DB dev.
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';

const B = process.env.CORE_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
const INTERNAL_KEY = process.env.INTERNAL_KEY ?? '';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@platform-acara.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
let pass = 0,
  fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : extra}`);
};
async function api(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(B + path, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}
const login = async (email, password) =>
  (await api('POST', '/auth/login', { body: { email, password } })).json.accessToken;

const sa = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
check('login super admin', !!sa);
const tree = (await api('GET', '/wilayah/tree', { token: sa })).json;
const selatan = tree[0].desa.find((d) => d.nama === 'Desa Selatan');
const utara = tree[0].desa.find((d) => d.nama === 'Desa Utara');
const kelMelati = selatan.kelompok.find((k) => k.nama === 'Kelompok Melati');
const kelAnggrek = utara.kelompok.find((k) => k.nama === 'Kelompok Anggrek');
const kategoriList = (await api('GET', '/kategori', { token: sa })).json;
const kat = Object.fromEntries(kategoriList.items.map((k) => [k.kode, k.id]));
check('daftar kategori awal tersedia', kat.CABERAWIT && kat.IBU_IBU && kategoriList.bisaKelola);
const katBaru = await api('POST', '/kategori', {
  token: sa,
  body: { nama: `Remaja Putri ${Date.now() % 100000}`, warna: 'fuchsia' },
});
check(
  'super admin menambah kategori',
  katBaru.status === 201 && katBaru.json.kode.startsWith('REMAJA_PUTRI'),
);
check(
  'kategori duplikat → 409',
  (await api('POST', '/kategori', { token: sa, body: { nama: katBaru.json.nama } })).status === 409,
);

const email = `admin.selatan.${Date.now()}@x.id`;
const u = await api('POST', '/users', {
  token: sa,
  body: {
    nama: 'Admin Selatan',
    email,
    password: 'rahasia123',
    role: 'ADMIN',
    scopes: [{ level: 'DESA', refId: selatan.id }],
  },
});
check('buat ADMIN scope Desa Selatan', u.status === 201, JSON.stringify(u.json));
const noScope = await api('POST', '/users', {
  token: sa,
  body: { nama: 'X', email: `x${Date.now()}@x.id`, password: 'rahasia123', role: 'ADMIN' },
});
check(
  'ADMIN tanpa scope ditolak',
  noScope.status === 400 && noScope.json.code === 'SCOPE_REQUIRED',
  JSON.stringify(noScope.json),
);
const ad = await login(email, 'rahasia123');
const usersAd = (await api('GET', '/users', { token: ad })).json;
check(
  'admin desa hanya melihat pengguna di desanya',
  Array.isArray(usersAd) &&
    usersAd.some((x) => x.email === email) &&
    usersAd.every((x) => x.role !== 'SUPER_ADMIN' && x.scopes.every((sc) => sc.level !== 'DAERAH')),
  JSON.stringify(usersAd).slice(0, 200),
);
check(
  'admin desa tidak bisa membuat admin daerah',
  (
    await api('POST', '/users', {
      token: ad,
      body: {
        nama: 'X',
        email: `y${Date.now()}@x.id`,
        password: 'rahasia123',
        role: 'ADMIN',
        scopes: [{ level: 'DAERAH', refId: tree[0].id }],
      },
    })
  ).status === 403,
);
check(
  'admin desa tidak bisa membuat super admin',
  (
    await api('POST', '/users', {
      token: ad,
      body: {
        nama: 'X',
        email: `z${Date.now()}@x.id`,
        password: 'rahasia123',
        role: 'SUPER_ADMIN',
      },
    })
  ).status === 403,
);
const auditorEmail = `auditor.melati.${Date.now()}@x.id`;
const auditorRes = await api('POST', '/users', {
  token: ad,
  body: {
    nama: 'Auditor Melati',
    email: auditorEmail,
    password: 'rahasia123',
    role: 'AUDITOR',
    scopes: [{ level: 'KELOMPOK', refId: kelMelati.id }],
  },
});
check(
  'admin desa membuat auditor kelompok',
  auditorRes.status === 201,
  JSON.stringify(auditorRes.json),
);
const au = await login(auditorEmail, 'rahasia123');
check(
  'kategori hanya dikelola admin daerah ke atas',
  (await api('POST', '/kategori', { token: ad, body: { nama: 'Coba' } })).json.code ===
    'OUT_OF_SCOPE',
);

const listSa = (await api('GET', '/anggota?pageSize=200', { token: sa })).json;
const listAd = (await api('GET', '/anggota?pageSize=200', { token: ad })).json;
check('super admin melihat semua anggota', listSa.total >= 40);
check(
  'admin desa hanya melihat Desa Selatan',
  listAd.items.every((a) => a.kelompok.desa.id === selatan.id) && listAd.total < listSa.total,
  `${listAd.total}`,
);
const treeAd = (await api('GET', '/wilayah/tree', { token: ad })).json;
check(
  'tree admin hanya Desa Selatan',
  treeAd.length === 1 && treeAd[0].desa.length === 1 && treeAd[0].bisaKelola === false,
  JSON.stringify(treeAd).slice(0, 200),
);
check(
  'admin tidak bisa buat daerah',
  (await api('POST', '/wilayah/daerah', { token: ad, body: { kode: 'ZZ', nama: 'Z' } })).status ===
    403,
);
check(
  'admin tidak bisa buat desa di daerah',
  (
    await api('POST', '/wilayah/desa', {
      token: ad,
      body: { kode: 'ZZ', nama: 'Z', daerahId: tree[0].id },
    })
  ).status === 403,
);
const newKel = await api('POST', '/wilayah/kelompok', {
  token: ad,
  body: {
    kode: `JS-T${Date.now() % 100000}`,
    nama: `Kelompok Uji ${Date.now()}`,
    desaId: selatan.id,
  },
});
check('admin bisa buat kelompok di desanya', newKel.status === 201, JSON.stringify(newKel.json));
check(
  'admin tidak bisa buat kelompok di desa lain',
  (
    await api('POST', '/wilayah/kelompok', {
      token: ad,
      body: { kode: 'JU-ZZ', nama: 'Z', desaId: utara.id },
    })
  ).status === 403,
);

const created = await api('POST', '/anggota', {
  token: ad,
  body: {
    nama: 'Uji Coba',
    jenisKelamin: 'L',
    tanggalLahir: '2011-01-02',
    kategoriIds: [kat.REMAJA],
    noWa: `0857 ${String(Date.now()).slice(-8)}`,
    kelompokId: kelMelati.id,
  },
});
check(
  'buat anggota + kode otomatis',
  created.status === 201 &&
    /^JS-\d{4}$/.test(created.json.kode) &&
    created.json.noWa.startsWith('62857') &&
    created.json.kategori.map((k) => k.kode).join() === 'REMAJA',
  JSON.stringify(created.json),
);
check(
  'anggota di desa lain ditolak',
  (
    await api('POST', '/anggota', {
      token: ad,
      body: { nama: 'X', jenisKelamin: 'L', kelompokId: kelAnggrek.id },
    })
  ).json.code === 'OUT_OF_SCOPE',
);
const dupWa = await api('POST', '/anggota', {
  token: ad,
  body: { nama: 'Y', jenisKelamin: 'P', noWa: created.json.noWa, kelompokId: kelMelati.id },
});
check('No WA duplikat → 409', dupWa.status === 409, JSON.stringify(dupWa.json));
const badWa = await api('POST', '/anggota', {
  token: ad,
  body: { nama: 'Y', jenisKelamin: 'P', noWa: '12', kelompokId: kelMelati.id },
});
check(
  'No WA tidak valid → VALIDATION_ERROR',
  badWa.json.code === 'VALIDATION_ERROR',
  JSON.stringify(badWa.json),
);
const utaraAnggota = listSa.items.find((a) => a.kelompok.desa.id === utara.id);
check(
  'detail anggota luar scope → 404',
  (await api('GET', `/anggota/${utaraAnggota.id}`, { token: ad })).status === 404,
);
check(
  'PATCH anggota luar scope → 404',
  (await api('PATCH', `/anggota/${utaraAnggota.id}`, { token: ad, body: { nama: 'X' } })).status ===
    404,
);
check(
  'PATCH status NONAKTIF',
  (await api('PATCH', `/anggota/${created.json.id}`, { token: ad, body: { status: 'NONAKTIF' } }))
    .json.status === 'NONAKTIF',
);
const badKategori = await api('PATCH', `/anggota/${created.json.id}`, {
  token: ad,
  body: { kategoriIds: ['tidak-ada'] },
});
check('kategori tidak dikenal → KATEGORI_INVALID', badKategori.json.code === 'KATEGORI_INVALID');
check(
  'kategori diubah manual, boleh lebih dari satu',
  (
    await api('PATCH', `/anggota/${created.json.id}`, {
      token: ad,
      body: { kategoriIds: [kat.IBU_IBU, kat.USIA_NIKAH] },
    })
  ).json.kategori
    .map((k) => k.kode)
    .join() === 'USIA_NIKAH,IBU_IBU',
);
const byKategori = (
  await api('GET', `/anggota?pageSize=200&kategoriId=${kat.USIA_NIKAH}`, { token: ad })
).json;
check(
  'filter kategori',
  byKategori.items.some((a) => a.id === created.json.id) &&
    byKategori.items.every((a) => a.kategori.some((k) => k.kode === 'USIA_NIKAH')),
);
const belum = (await api('GET', '/anggota?pageSize=200&kategoriId=BELUM', { token: sa })).json;
check(
  'filter kategori belum diisi',
  belum.total > 0 && belum.items.every((a) => a.kategori.length === 0),
  `${belum.total}`,
);

const wali = await api('POST', '/wali', {
  token: ad,
  body: {
    nama: 'Ibu Uji',
    noWa: `0819${String(Date.now()).slice(-8)}`,
    anak: [{ anggotaId: created.json.id, hubungan: 'IBU' }],
  },
});
check(
  'buat wali + tautkan anak',
  wali.status === 201 && wali.json.anak.length === 1,
  JSON.stringify(wali.json),
);
check(
  'wali dengan anak luar scope ditolak',
  (
    await api('POST', '/wali', {
      token: ad,
      body: {
        nama: 'Z',
        noWa: `0819${String(Date.now() + 1).slice(-8)}`,
        anak: [{ anggotaId: utaraAnggota.id, hubungan: 'AYAH' }],
      },
    })
  ).json.code === 'OUT_OF_SCOPE',
);

const mut = await api('POST', `/anggota/${created.json.id}/mutasi`, {
  token: ad,
  body: { keKelompokId: kelAnggrek.id, tanggal: '2026-10-01', catatan: 'pindah rumah' },
});
check('mutasi ke desa lain', mut.status === 201, JSON.stringify(mut.json));
check(
  'setelah mutasi keluar, anggota tidak terlihat admin desa',
  (await api('GET', `/anggota/${created.json.id}`, { token: ad })).status === 404,
);
const detailSa = (await api('GET', `/anggota/${created.json.id}`, { token: sa })).json;
check(
  'super admin melihat riwayat mutasi + kode tetap',
  detailSa.mutasi.length === 1 && detailSa.kode === created.json.kode && detailSa.wali.length === 1,
);

// Import 100 baris valid + 3 baris salah
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Anggota');
ws.addRow([
  'Nama',
  'JK',
  'Tgl Lahir',
  'Kategori',
  'No WA',
  'No WA Ortu',
  'Nama Ortu',
  'Kelompok',
  'Desa',
  'Daerah',
]);
const stamp = String(Date.now()).slice(-5);
for (let i = 0; i < 100; i++) {
  ws.addRow([
    `Import ${stamp} ${i}`,
    i % 2 ? 'P' : 'L',
    `${(i % 28) + 1}/0${(i % 9) + 1}/2012`,
    ['', 'Caberawit', 'pra remaja', 'Remaja', 'Usia Nikah, Ibu-ibu'][i % 5],
    i % 3 === 0 ? `0877${stamp}${String(i).padStart(3, '0')}` : '',
    i % 3 === 1 ? `0878${stamp}${String(i).padStart(3, '0')}` : '',
    'Ortu',
    i % 2 ? 'kelompok mawar' : 'Kelompok Melati',
    'Desa Selatan',
    'Daerah Contoh',
  ]);
}
ws.addRow(['', 'L', '', '', '', '', '', 'Kelompok Melati', 'Desa Selatan', 'Daerah Contoh']);
ws.addRow([
  'Salah Wilayah',
  'L',
  '',
  '',
  '',
  '',
  '',
  'Kelompok Anggrek',
  'Desa Utara',
  'Daerah Contoh',
]);
ws.addRow([
  'Salah Tanggal',
  'P',
  '30/02/2012',
  '',
  '',
  '',
  '',
  'Kelompok Melati',
  'Desa Selatan',
  'Daerah Contoh',
]);
ws.addRow([
  'Salah Kategori',
  'P',
  '',
  'Astronot',
  '',
  '',
  '',
  'Kelompok Melati',
  'Desa Selatan',
  'Daerah Contoh',
]);
const buf = Buffer.from(await wb.xlsx.writeBuffer());
const form = () => {
  const f = new FormData();
  f.append('file', new Blob([buf]), 'anggota.xlsx');
  return f;
};
const before = (await api('GET', '/anggota?pageSize=1', { token: sa })).json.total;
const dry = await api('POST', '/anggota/import?dryRun=true', { token: ad, form: form() });
check(
  'import dry-run: 100 valid, 4 gagal',
  dry.json.valid === 100 && dry.json.gagal === 4 && dry.json.dibuat === 0,
  JSON.stringify(dry.json).slice(0, 300),
);
check(
  'dry-run tidak menyimpan',
  (await api('GET', '/anggota?pageSize=1', { token: sa })).json.total === before,
);
console.log('     errors:', JSON.stringify(dry.json.errors));
const t0 = Date.now();
const real = await api('POST', '/anggota/import', { token: ad, form: form() });
check(
  `import: 100 dibuat (${Date.now() - t0} ms)`,
  real.json.dibuat === 100,
  JSON.stringify(real.json).slice(0, 300),
);
const after = (await api('GET', `/anggota?pageSize=200&q=Import ${stamp}`, { token: ad })).json;
check(
  '100 anggota import terlihat di desa',
  after.total === 100 && new Set(after.items.map((a) => a.kode)).size === 100,
);
check(
  'kolom Kategori ikut diimpor (kosong = belum diisi)',
  after.items.filter((a) => a.kategori.some((k) => k.kode === 'PRAREMAJA')).length === 20 &&
    after.items.filter((a) => a.kategori.length === 2).length === 20 &&
    after.items.filter((a) => a.kategori.length === 0).length === 20,
);
const again = await api('POST', '/anggota/import?dryRun=true', { token: ad, form: form() });
check(
  'import ulang: No WA yang sama ditolak',
  again.json.errors.some((e) => e.pesan.some((p) => p.includes('sudah dipakai'))),
);
const waliList = (await api('GET', '/wali?pageSize=200', { token: ad })).json;
check('wali hasil import terlihat', waliList.total >= 30, `${waliList.total}`);
const badFile = new FormData();
badFile.append('file', new Blob([Buffer.from('bukan excel')]), 'x.xlsx');
check(
  'file bukan xlsx → FILE_INVALID',
  (await api('POST', '/anggota/import?dryRun=true', { token: ad, form: badFile })).json.code ===
    'FILE_INVALID',
);
const tmpl = await fetch(B + '/anggota/import/template', {
  headers: { authorization: `Bearer ${ad}` },
});
check(
  'download template xlsx',
  tmpl.status === 200 && (await tmpl.arrayBuffer()).byteLength > 1000,
);

const internal = await fetch(`${B}/internal/anggota?ids=${created.json.id}`, {
  headers: { 'x-internal-key': INTERNAL_KEY },
}).then((r) => r.json());
check(
  'internal anggota memakai format event',
  internal[0]?.namaDesa === 'Desa Utara' &&
    internal[0]?.waliNoWa.length === 1 &&
    internal[0]?.kategori.join() === 'IBU_IBU,USIA_NIKAH',
  JSON.stringify(internal),
);

const riwayat = (await api('GET', `/anggota/${created.json.id}/riwayat`, { token: sa })).json;
const aksi = new Set(riwayat.map((r) => r.aksi));
check(
  'riwayat anggota: tambah, ubah, wali, pindah',
  ['CREATE', 'UPDATE', 'WALI', 'MUTASI'].every((x) => aksi.has(x)) &&
    riwayat.every((r) => r.userNama === 'Admin Selatan'),
  JSON.stringify([...aksi]),
);
const ubahKat = riwayat.find((r) => r.aksi === 'UPDATE' && r.data.kategori);
check(
  'riwayat mencatat sebelum & sesudah',
  ubahKat?.data.kategori[0] === '["Remaja"]',
  JSON.stringify(ubahKat),
);
check(
  'auditor bisa melihat anggota',
  (await api('GET', '/anggota?pageSize=5', { token: au })).status === 200,
);
check(
  'auditor tidak bisa mengubah data',
  (
    await api('POST', '/anggota', {
      token: au,
      body: { nama: 'X', jenisKelamin: 'L', kelompokId: kelMelati.id },
    })
  ).status === 403,
);
const auditAu = (await api('GET', '/audit?pageSize=200', { token: au })).json;
check(
  'auditor kelompok hanya melihat riwayat kelompoknya',
  auditAu.total > 0 && auditAu.items.every((r) => r.kelompokId === kelMelati.id),
  `${auditAu.total}`,
);
const auditSa = (await api('GET', '/audit?entitas=Kategori', { token: sa })).json;
check(
  'super admin melihat riwayat kategori',
  auditSa.items.some((r) => r.entitasId === katBaru.json.id),
);
check(
  'auditor tidak melihat riwayat kategori',
  (await api('GET', '/audit?entitas=Kategori', { token: au })).json.total === 0,
);

// Dashboard
const dashAd = (await api('GET', '/dashboard/ringkasan', { token: ad })).json;
const totalAd = (await api('GET', '/anggota?pageSize=1', { token: ad })).json.total;
check(
  'dashboard admin desa hanya berisi desanya',
  dashAd.total === totalAd &&
    dashAd.wilayah.length === 1 &&
    dashAd.wilayah[0].id === selatan.id &&
    dashAd.kategori.length > 0 &&
    dashAd.pertumbuhan.length === 12,
  JSON.stringify({ total: dashAd.total, totalAd, wilayah: dashAd.wilayah?.map((w) => w.nama) }),
);
const dashSa = (await api('GET', '/dashboard/ringkasan', { token: sa })).json;
check(
  'dashboard super admin mencakup semua desa',
  dashSa.total > dashAd.total && dashSa.wilayah.length >= 2,
);
const dashAu = await api('GET', '/dashboard/audit', { token: au });
check(
  'auditor melihat aktivitas perubahan di wilayahnya',
  dashAu.status === 200 &&
    dashAu.json.perHari.length === 30 &&
    dashAu.json.total > 0 &&
    dashAu.json.terbaru.every((r) => r.kelompokId === kelMelati.id),
  JSON.stringify(dashAu.json).slice(0, 200),
);
const pengurusEmail = `pengurus.${Date.now()}@x.id`;
await api('POST', '/users', {
  token: sa,
  body: {
    nama: 'Pengurus Uji',
    email: pengurusEmail,
    password: 'rahasia123',
    role: 'PENGURUS',
    scopes: [{ level: 'DESA', refId: selatan.id }],
  },
});
const pg = await login(pengurusEmail, 'rahasia123');
check(
  'pengurus melihat ringkasan, bukan aktivitas audit',
  (await api('GET', '/dashboard/ringkasan', { token: pg })).status === 200 &&
    (await api('GET', '/dashboard/audit', { token: pg })).status === 403,
);

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exitCode = fail ? 1 : 0;
