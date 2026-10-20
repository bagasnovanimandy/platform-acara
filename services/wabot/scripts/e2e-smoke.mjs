/**
 * Uji asap end-to-end wabot-svc: alur izin lewat WA (driver fake) sampai masuk rekap acara.
 * Butuh core-svc, acara-svc, dan wabot-svc (WA_DRIVER=fake) berjalan + data seed core.
 * Membuat data uji baru setiap kali, jadi aman diulang di DB dev.
 */
import 'dotenv/config';

const CORE = process.env.CORE_URL ?? 'http://localhost:3001';
const ACARA = process.env.ACARA_URL ?? 'http://localhost:3002';
const WABOT = `http://localhost:${process.env.PORT ?? 3003}`;
const KEY = process.env.INTERNAL_KEY ?? '';
let pass = 0,
  fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : extra}`);
};
async function api(base, method, path, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (body) h['content-type'] = 'application/json';
  const res = await fetch(base + path, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
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
  (await api(CORE, 'POST', '/auth/login', { body: { email, password } })).json.accessToken;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tunggu(fn, ms = 10000) {
  const sampai = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > sampai) return v;
    await sleep(300);
  }
}
/** Kirim pesan seolah dari WA; kembalikan pesan keluar per nomor. */
async function wa(noWa, teks) {
  const r = await api(WABOT, 'POST', '/wa/simulasi', {
    body: { noWa, teks },
    headers: { 'x-internal-key': KEY },
  });
  if (r.status !== 200) throw new Error(`simulasi ${r.status} ${JSON.stringify(r.json)}`);
  const ke = (n) => r.json.keluar.filter((k) => k.noWa === n).map((k) => k.isi);
  return { semua: r.json.keluar, ke, teks: ke(noWa).join('\n---\n') };
}
const nomor = (prefix) =>
  `${prefix}${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 10)}`;

const sa = await login(
  process.env.SEED_ADMIN_EMAIL ?? 'admin@platform-acara.local',
  process.env.SEED_ADMIN_PASSWORD ?? 'admin12345',
);
const ad = await login('admin.selatan@platform-acara.local', 'contoh12345');
check('login super admin & admin desa', !!sa && !!ad);
const tree = (await api(CORE, 'GET', '/wilayah/tree', { token: sa })).json;
const selatan = tree[0].desa.find((d) => d.nama === 'Desa Selatan');
const melati = selatan.kelompok.find((k) => k.nama === 'Kelompok Melati');
const mawar = selatan.kelompok.find((k) => k.nama === 'Kelompok Mawar');

// --- Data uji: pengurus (PJ izin), anggota dengan WA sendiri, wali dengan dua anak
const t = Date.now() % 100000;
const waPj = nomor('62813');
const pj = await api(CORE, 'POST', '/users', {
  token: ad,
  body: {
    nama: `PJ Izin ${t}`,
    email: `pj.izin.${t}@x.id`,
    password: 'rahasia123',
    role: 'PENGURUS',
    noWa: waPj,
    scopes: [{ level: 'KELOMPOK', refId: melati.id }],
  },
});
check('buat pengurus PJ izin dengan nomor WA', pj.status === 201, JSON.stringify(pj.json));
const waAud = nomor('62814');
await api(CORE, 'POST', '/users', {
  token: ad,
  body: {
    nama: `Auditor ${t}`,
    email: `aud.izin.${t}@x.id`,
    password: 'rahasia123',
    role: 'AUDITOR',
    noWa: waAud,
    scopes: [{ level: 'DESA', refId: selatan.id }],
  },
});
const audTok = await login(`aud.izin.${t}@x.id`, 'rahasia123');

const buatAnggota = async (nama, kelompokId, noWa) =>
  (
    await api(CORE, 'POST', '/anggota', {
      token: ad,
      body: { nama, jenisKelamin: 'L', kelompokId, kategoriIds: [], ...(noWa ? { noWa } : {}) },
    })
  ).json;
const waA = nomor('62815');
const a = await buatAnggota(`Izin Uji ${t}`, melati.id, waA);
const anak1 = await buatAnggota(`Anak Satu ${t}`, melati.id);
const anak2 = await buatAnggota(`Anak Dua ${t}`, mawar.id);
const waWali = nomor('62816');
const wali = await api(CORE, 'POST', '/wali', {
  token: ad,
  body: {
    nama: `Wali ${t}`,
    noWa: waWali,
    anak: [
      { anggotaId: anak1.id, hubungan: 'AYAH' },
      { anggotaId: anak2.id, hubungan: 'AYAH' },
    ],
  },
});
check('buat anggota & wali dua anak', !!a.id && wali.status === 201, JSON.stringify(wali.json));

// Event anggota.upserted bisa tertinggal: tarik ulang juga.
await api(ACARA, 'POST', '/sync/anggota', { token: sa });
await api(WABOT, 'POST', '/sync/anggota', { token: sa });
const terdaftar = await tunggu(
  async () => !(await wa(waA, 'menu')).teks.includes('belum terdaftar'),
);
check('nomor anggota dikenali bot setelah sinkron', terdaftar);
check('nomor wali dikenali bot', !(await wa(waWali, 'menu')).teks.includes('belum terdaftar'));

// --- Acara desa dengan PJ izin, satu sesi mendatang + satu sesi yang sudah lewat batas izin
const now = Date.now(),
  iso = (ms) => new Date(ms).toISOString();
const acara = (
  await api(ACARA, 'POST', '/acara', {
    token: ad,
    body: {
      nama: `Pengajian Izin ${t}`,
      jenis: 'Pengajian desa',
      lokasi: 'Masjid Uji',
      tanggalMulai: iso(now - 36e5),
      tanggalSelesai: iso(now + 3 * 864e5),
      status: 'TERJADWAL',
      tingkat: 'DESA',
      wilayah: [{ level: 'DESA', id: selatan.id }],
    },
  })
).json;
let det = (
  await api(ACARA, 'POST', `/acara/${acara.id}/sesi`, {
    token: ad,
    body: {
      nama: 'Sesi Pagi',
      mulai: iso(now + 2 * 864e5),
      selesai: iso(now + 2 * 864e5 + 2 * 36e5),
    },
  })
).json;
det = (
  await api(ACARA, 'POST', `/acara/${acara.id}/sesi`, {
    token: ad,
    body: {
      nama: 'Sesi Tutup',
      mulai: iso(now + 864e5),
      selesai: iso(now + 864e5 + 36e5),
      batasIzin: iso(now - 6e4),
    },
  })
).json;
const sesiPagi = det.sesi.find((s) => s.nama === 'Sesi Pagi');
const pjRes = await api(ACARA, 'POST', `/acara/${acara.id}/pj`, {
  token: ad,
  body: { userId: pj.json.id, peran: 'PJ_IZIN' },
});
check(
  'acara + sesi + PJ izin dibuat',
  !!sesiPagi && pjRes.status === 201,
  JSON.stringify(pjRes.json),
);

// --- Alur anggota: menu → ajukan izin → pilih acara → sakit → alasan → kirim
let r = await wa(waA, 'menu');
check(
  'menu bot tampil',
  r.teks.includes('1. Ajukan izin') && r.teks.includes('3. Jadwal acara terdekat'),
);
r = await wa(waA, '1');
const baris = r.teks
  .split('\n')
  .find((l) => l.includes(`Pengajian Izin ${t}`) && l.includes('Sesi Pagi'));
check('daftar acara memuat sesi mendatang', !!baris, r.teks);
check('sesi lewat batas izin tidak ditawarkan', !r.teks.includes('Sesi Tutup'), r.teks);
r = await wa(waA, baris.split('.')[0]);
check('pilih acara → kategori', r.teks.includes('1. Izin') && r.teks.includes('2. Sakit'));
r = await wa(waA, '2');
check('pilih sakit → minta alasan', r.teks.includes('Tulis alasan'));
check(
  'alasan > 300 karakter ditolak',
  (await wa(waA, 'x'.repeat(301))).teks.includes('terlalu panjang'),
);
r = await wa(waA, 'demam sejak semalam');
check(
  'draft ringkasan',
  r.teks.includes('Kategori : Sakit') &&
    r.teks.includes('demam sejak semalam') &&
    r.teks.includes('1. Kirim'),
  r.teks,
);
r = await wa(waA, '1');
const nomorA = /IZ-(\d{4,})/.exec(r.teks)?.[1];
check('izin terkirim dengan nomor', !!nomorA && r.teks.includes('menunggu persetujuan'), r.teks);
const kePj = r.ke(waPj).join('\n');
check(
  'pengajuan diteruskan ke WA PJ izin',
  kePj.includes(`Pengajuan izin #IZ-${nomorA}`) &&
    kePj.includes(`SETUJU ${nomorA}`) &&
    kePj.includes('Kategori: Sakit'),
  JSON.stringify(r.semua),
);

// Pengajuan ganda untuk sesi yang sama
await wa(waA, 'menu');
r = await wa(waA, '1');
const b2 = r.teks
  .split('\n')
  .find((l) => l.includes(`Pengajian Izin ${t}`) && l.includes('Sesi Pagi'));
await wa(waA, b2.split('.')[0]);
await wa(waA, '1');
await wa(waA, 'izin lagi');
r = await wa(waA, '1');
check('pengajuan ganda ditolak', r.teks.includes(`Sudah ada pengajuan IZ-${nomorA}`), r.teks);

// --- Izin terlihat di web & di acara
const list = await api(WABOT, 'GET', '/izin?status=SUBMITTED', { token: ad });
const izinA = list.json.items?.find((i) => String(i.nomor).padStart(4, '0') === nomorA);
check(
  'admin desa melihat izin menunggu',
  !!izinA && izinA.bisaPutus === true,
  JSON.stringify(list.json).slice(0, 300),
);
check(
  'jumlah izin menunggu',
  (await api(WABOT, 'GET', '/izin/jumlah', { token: ad })).json.menunggu >= 1,
);
const audList = await api(WABOT, 'GET', '/izin', { token: audTok });
check(
  'auditor melihat izin tetapi tidak bisa memutuskan',
  audList.status === 200 && audList.json.items.every((i) => !i.bisaPutus),
);
check(
  'auditor tidak bisa memutuskan lewat web',
  (
    await api(WABOT, 'POST', `/izin/${izinA.id}/decide`, {
      token: audTok,
      body: { status: 'APPROVED' },
    })
  ).status === 403,
);
check(
  'auditor tidak bisa memutuskan lewat WA',
  (await wa(waAud, `SETUJU ${nomorA}`)).teks.includes('tidak berwenang'),
);

// --- PJ menyetujui lewat WA → pengaju dikabari → rekap acara menjadi SAKIT
r = await wa(waPj, `setuju ${nomorA}`);
check(
  'PJ setuju lewat WA',
  r.teks.includes(`IZ-${nomorA}`) && r.teks.includes('disetujui'),
  r.teks,
);
check(
  'pengaju menerima keputusan',
  r.ke(waA).join().includes('*disetujui*'),
  JSON.stringify(r.semua),
);
check(
  'keputusan kedua ditolak',
  (await wa(waPj, `TOLAK ${nomorA} salah`)).teks.includes('sudah diputuskan'),
);
const rekapA = await tunggu(async () => {
  const rk = await api(ACARA, 'GET', `/sesi/${sesiPagi.id}/rekap`, { token: ad });
  return rk.json.items?.find((x) => x.anggota.id === a.id)?.status === 'SAKIT' ? rk.json : null;
});
check('izin disetujui masuk rekap sebagai SAKIT', !!rekapA);

// --- Wali dua anak: pilih anak → izin → ditolak lewat web
r = await wa(waWali, 'menu');
check(
  'wali disapa sebagai wali',
  (await wa(waWali, 'batal'), (await wa(waWali, 'halo')).teks.includes('wali dari')),
);
r = await wa(waWali, '1');
check(
  'wali memilih anak',
  r.teks.includes(`Anak Dua ${t}`) && r.teks.includes(`Anak Satu ${t}`),
  r.teks,
);
const noAnak2 = r.teks
  .split('\n')
  .find((l) => l.includes(`Anak Dua ${t}`))
  .split('.')[0];
r = await wa(waWali, noAnak2);
const b3 = r.teks
  .split('\n')
  .find((l) => l.includes(`Pengajian Izin ${t}`) && l.includes('Sesi Pagi'));
check('acara anak kedua tampil', !!b3, r.teks);
await wa(waWali, b3.split('.')[0]);
await wa(waWali, '1');
await wa(waWali, 'acara keluarga');
r = await wa(waWali, '1');
const nomorW = /IZ-(\d{4,})/.exec(r.teks)?.[1];
check('izin wali terkirim', !!nomorW, r.teks);
const izinW = (await api(WABOT, 'GET', `/izin?q=IZ-${nomorW}`, { token: ad })).json.items[0];
check(
  'izin wali tercatat sebagai pengaju WALI',
  izinW?.pengajuTipe === 'WALI' && izinW.anggotaId === anak2.id,
);
const dec = await api(WABOT, 'POST', `/izin/${izinW.id}/decide`, {
  token: ad,
  body: { status: 'REJECTED', catatan: 'wajib hadir' },
});
check(
  'admin menolak lewat web',
  dec.status === 200 && dec.json.status === 'REJECTED' && dec.json.decidedVia === 'WEB',
);
const pesanWali = await tunggu(async () => {
  const log = (await api(WABOT, 'GET', `/wa/pesan?noWa=${waWali}`, { token: sa })).json;
  return log.find(
    (m) => m.arah === 'KELUAR' && m.isi.includes(`IZ-${nomorW}`) && m.isi.includes('*ditolak*'),
  );
});
check(
  'wali menerima penolakan + catatan',
  !!pesanWali && pesanWali.isi.includes('Catatan: wajib hadir'),
);
await sleep(800);
const rk2 = await api(ACARA, 'GET', `/sesi/${sesiPagi.id}/rekap`, { token: ad });
check(
  'izin ditolak → tetap ALPHA di rekap',
  rk2.json.items.find((x) => x.anggota.id === anak2.id)?.status === 'ALPHA',
);

// --- Acara tanpa PJ izin: diteruskan ke pengurus kelompok anggota (Kelompok Melati)
const acara2 = (
  await api(ACARA, 'POST', '/acara', {
    token: ad,
    body: {
      nama: `Kajian Tanpa PJ ${t}`,
      jenis: 'Kajian',
      tanggalMulai: iso(now),
      tanggalSelesai: iso(now + 4 * 864e5),
      status: 'TERJADWAL',
      tingkat: 'DESA',
      wilayah: [{ level: 'DESA', id: selatan.id }],
    },
  })
).json;
await api(ACARA, 'POST', `/acara/${acara2.id}/sesi`, {
  token: ad,
  body: { nama: 'Sesi Malam', mulai: iso(now + 3 * 864e5), selesai: iso(now + 3 * 864e5 + 36e5) },
});
await wa(waWali, 'menu');
r = await wa(waWali, '1');
const noAnak1 = r.teks
  .split('\n')
  .find((l) => l.includes(`Anak Satu ${t}`))
  .split('.')[0];
r = await wa(waWali, noAnak1);
const b4 = r.teks.split('\n').find((l) => l.includes(`Kajian Tanpa PJ ${t}`));
await wa(waWali, b4.split('.')[0]);
await wa(waWali, '1');
await wa(waWali, 'ke rumah nenek');
r = await wa(waWali, '1');
const nomorF = /IZ-(\d{4,})/.exec(r.teks)?.[1];
check(
  'tanpa PJ izin → diteruskan ke pengurus kelompok',
  !!nomorF && r.ke(waPj).join().includes(`#IZ-${nomorF}`),
  JSON.stringify(r.semua),
);
check(
  'pengurus kelompok bisa memutuskan lewat WA',
  (await wa(waPj, `TOLAK ${nomorF}`)).teks.includes('ditolak'),
);

// --- Status & jadwal
await wa(waWali, 'menu');
r = await wa(waWali, '2');
check(
  'cek status izin wali',
  r.teks.includes(`IZ-${nomorW}`) &&
    r.teks.includes('*Ditolak*') &&
    r.teks.includes('Catatan: wajib hadir'),
  r.teks,
);
r = await wa(waA, 'menu');
r = await wa(waA, '3');
check(
  'jadwal acara terdekat',
  r.teks.includes(`Pengajian Izin ${t}`) && r.teks.includes('Masjid Uji'),
  r.teks,
);

// --- Nomor asing, keamanan, status WA
const asing = nomor('62817');
check('nomor asing dibalas sekali', (await wa(asing, 'halo')).teks.includes('belum terdaftar'));
check('nomor asing tidak dibalas berulang', (await wa(asing, 'halo lagi')).semua.length === 0);
check(
  'simulasi tanpa kunci internal → 401',
  (await api(WABOT, 'POST', '/wa/simulasi', { body: { noWa: asing, teks: 'x' } })).status === 401,
);
check('daftar izin tanpa login → 401', (await api(WABOT, 'GET', '/izin')).status === 401);
const st = await api(WABOT, 'GET', '/wa/status', { token: ad });
check(
  'status WA untuk admin',
  st.status === 200 && st.json.driver === 'fake' && st.json.keadaan === 'TERHUBUNG',
);
check(
  'log pesan hanya super admin',
  (await api(WABOT, 'GET', '/wa/pesan', { token: ad })).status === 403,
);

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
