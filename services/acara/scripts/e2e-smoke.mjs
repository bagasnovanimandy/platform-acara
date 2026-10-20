/**
 * Uji asap end-to-end acara-svc. Butuh core-svc (dengan data seed) dan acara-svc berjalan.
 * Jalankan: pnpm --filter @platform-acara/acara test:e2e
 * Membuat acara baru setiap kali, jadi aman diulang di DB dev.
 */
import 'dotenv/config';
import sharp from 'sharp';

const CORE = process.env.CORE_URL ?? 'http://localhost:3001';
const B = process.env.ACARA_URL ?? `http://localhost:${process.env.PORT ?? 3002}`;
const SA_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@platform-acara.local';
const SA_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
const DEMO_PASSWORD = 'contoh12345';
let pass = 0,
  fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${ok ? '' : extra}`);
};
async function req(base, method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const type = res.headers.get('content-type') ?? '';
  if (type.startsWith('image/'))
    return { status: res.status, type, size: (await res.arrayBuffer()).byteLength };
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json, type };
}
const core = (m, p, o) => req(CORE, m, p, o);
const api = (m, p, o) => req(B, m, p, o);
const login = async (email, password = DEMO_PASSWORD) =>
  (await core('POST', '/auth/login', { body: { email, password } })).json.accessToken;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 8000) => {
  for (let t = 0; t < ms; t += 250) {
    if (await fn()) return true;
    await sleep(250);
  }
  return false;
};

const sa = await login(SA_EMAIL, SA_PASSWORD);
const adminSelatan = await login('admin.selatan@platform-acara.local');
const auditor = await login('auditor@platform-acara.local');
check('login SA, admin desa, auditor', sa && adminSelatan && auditor);
// Resync awal acara-svc berjalan di latar saat start; tunggu salinan anggota lengkap dulu.
check(
  'sinkron penuh salinan anggota dari core',
  (await api('POST', '/sync/anggota?full=true', { token: sa })).status === 201,
);

check('tanpa token → 401', (await api('GET', '/acara')).status === 401);
check('token palsu → 401', (await api('GET', '/acara', { token: 'abc.def.ghi' })).status === 401);

// Data acuan dari core
const tree = (await core('GET', '/wilayah/tree', { token: sa })).json;
const daerah = tree[0];
const selatan = daerah.desa.find((d) => d.nama === 'Desa Selatan');
const utara = daerah.desa.find((d) => d.nama === 'Desa Utara');
const [kel1, kel2] = selatan.kelompok;
const coreCount = async (qs) =>
  (await core('GET', `/anggota?status=AKTIF&pageSize=1&${qs}`, { token: sa })).json.total;
const totalSelatan = await coreCount(`desaId=${selatan.id}`);
const kategori = (await core('GET', '/kategori', { token: sa })).json.items;
const remaja = kategori.find((k) => k.kode === 'REMAJA');

// --- Preview peserta
const pv = await api('POST', '/acara/peserta/preview', {
  token: adminSelatan,
  body: { tingkat: 'DESA', wilayah: [{ level: 'DESA', id: selatan.id }] },
});
check(
  'preview tingkat desa = jumlah anggota aktif desa di core',
  pv.status === 200 && pv.json.total === totalSelatan,
  `${pv.json.total} vs ${totalSelatan}`,
);
check(
  'preview: penyelenggara desa + rincian per kelompok',
  pv.json.penyelenggara?.id === selatan.id &&
    pv.json.perKelompok.reduce((s, k) => s + k.jumlah, 0) === totalSelatan,
);
const pvGab = await api('POST', '/acara/peserta/preview', {
  token: adminSelatan,
  body: {
    tingkat: 'GABUNGAN',
    wilayah: [
      { level: 'KELOMPOK', id: kel1.id },
      { level: 'KELOMPOK', id: kel2.id },
    ],
    kategori: ['REMAJA'],
    jenisKelamin: 'P',
  },
});
check(
  'preview gabungan 2 kelompok × remaja × perempuan',
  pvGab.status === 200 &&
    pvGab.json.total ===
      (await coreCount(`kelompokId=${kel1.id}&kategoriId=${remaja.id}&jenisKelamin=P`)) +
        (await coreCount(`kelompokId=${kel2.id}&kategoriId=${remaja.id}&jenisKelamin=P`)) &&
    pvGab.json.penyelenggara?.id === selatan.id &&
    (pvGab.json.total === 0 || pvGab.json.perKategori.REMAJA === pvGab.json.total),
  JSON.stringify(pvGab.json).slice(0, 300),
);
check(
  'tingkat KELOMPOK dengan wilayah desa → 400',
  (
    await api('POST', '/acara/peserta/preview', {
      token: adminSelatan,
      body: { tingkat: 'KELOMPOK', wilayah: [{ level: 'DESA', id: selatan.id }] },
    })
  ).json.code === 'PESERTA_INVALID',
);
check(
  'admin Desa Selatan memilih Desa Utara → 403',
  (
    await api('POST', '/acara/peserta/preview', {
      token: adminSelatan,
      body: { tingkat: 'DESA', wilayah: [{ level: 'DESA', id: utara.id }] },
    })
  ).status === 403,
);
check(
  'kode kategori tidak valid → 400',
  (
    await api('POST', '/acara/peserta/preview', {
      token: adminSelatan,
      body: {
        tingkat: 'DESA',
        wilayah: [{ level: 'DESA', id: selatan.id }],
        kategori: ['re maja'],
      },
    })
  ).status === 400,
);

// --- Buat acara
const mulai = new Date(Date.now() + 7 * 864e5);
mulai.setUTCHours(1, 0, 0, 0);
const iso = (d, jam = 0) => new Date(d.getTime() + jam * 36e5).toISOString();
const baru = await api('POST', '/acara', {
  token: adminSelatan,
  body: {
    nama: `Pengajian Remaja Selatan ${Date.now() % 100000}`,
    jenis: 'Pengajian desa',
    lokasi: 'Masjid Desa Selatan',
    tanggalMulai: iso(mulai),
    tanggalSelesai: iso(mulai, 3),
    tingkat: 'DESA',
    wilayah: [{ level: 'DESA', id: selatan.id }],
    kategori: ['REMAJA', 'PRAREMAJA'],
  },
});
const acara = baru.json;
check(
  'admin desa membuat acara',
  baru.status === 201 &&
    acara.bisaKelola &&
    acara.status === 'DRAFT' &&
    acara.penyelenggaraNama === selatan.nama,
  JSON.stringify(baru.json).slice(0, 300),
);
check('jumlah peserta acara terhitung', typeof acara.jumlahPeserta === 'number');
check(
  'tanggal selesai sebelum mulai → 400',
  (
    await api('POST', '/acara', {
      token: adminSelatan,
      body: {
        ...baru.json,
        nama: 'x',
        tanggalMulai: iso(mulai, 3),
        tanggalSelesai: iso(mulai),
        wilayah: [{ level: 'DESA', id: selatan.id }],
      },
    })
  ).json.code === 'WAKTU_INVALID',
);
check(
  'PENGURUS/AUDITOR tidak bisa membuat acara',
  (await api('POST', '/acara', { token: auditor, body: {} })).status === 403,
);

const acaraDaerah = (
  await api('POST', '/acara', {
    token: sa,
    body: {
      nama: `Pengajian Daerah ${Date.now() % 100000}`,
      jenis: 'Pengajian daerah',
      tanggalMulai: iso(mulai, 24),
      tanggalSelesai: iso(mulai, 27),
      status: 'TERJADWAL',
      tingkat: 'DAERAH',
      wilayah: [{ level: 'DAERAH', id: daerah.id }],
    },
  })
).json;
check('SA membuat acara tingkat daerah', acaraDaerah.penyelenggaraLevel === 'DAERAH');

// --- Visibilitas & hak ubah
const listSel = (await api('GET', '/acara?pageSize=100', { token: adminSelatan })).json.items;
check(
  'admin desa melihat acara desanya dan acara daerah',
  listSel.some((a) => a.id === acara.id) && listSel.some((a) => a.id === acaraDaerah.id),
);
const lihatDaerah = (await api('GET', `/acara/${acaraDaerah.id}`, { token: adminSelatan })).json;
check('acara daerah: admin desa tidak bisa kelola', lihatDaerah.bisaKelola === false);
check(
  'admin desa ubah acara daerah → 403',
  (await api('PATCH', `/acara/${acaraDaerah.id}`, { token: adminSelatan, body: { nama: 'x' } }))
    .status === 403,
);
const audGet = await api('GET', `/acara/${acara.id}`, { token: auditor });
check('auditor melihat acara (tanpa hak kelola)', audGet.status === 200 && !audGet.json.bisaKelola);
check(
  'filter tanggal (kalender)',
  (
    await api(
      'GET',
      `/acara?dari=${encodeURIComponent(iso(mulai, -1))}&sampai=${encodeURIComponent(iso(mulai, 4))}&pageSize=100`,
      { token: sa },
    )
  ).json.items.every((a) => a.id !== acaraDaerah.id),
);

// --- Ubah acara & aturan peserta
const upd = await api('PATCH', `/acara/${acara.id}`, {
  token: adminSelatan,
  body: {
    status: 'TERJADWAL',
    kategori: [],
    tingkat: 'KELOMPOK',
    wilayah: [{ level: 'KELOMPOK', id: kel1.id }],
  },
});
check(
  'ubah peserta → tingkat kelompok, penyelenggara pindah ke kelompok',
  upd.status === 200 &&
    upd.json.penyelenggaraId === kel1.id &&
    upd.json.jumlahPeserta === (await coreCount(`kelompokId=${kel1.id}`)),
  JSON.stringify(upd.json).slice(0, 300),
);
const pesertaList = (await api('GET', `/acara/${acara.id}/peserta?pageSize=5`, { token: auditor }))
  .json;
check(
  'daftar peserta (paginated) tanpa data pribadi',
  pesertaList.total === upd.json.jumlahPeserta &&
    pesertaList.items.length <= 5 &&
    pesertaList.items.every((p) => !('noWa' in p) && !('tanggalLahir' in p)),
);

// --- Sesi & rundown
const sesiErr = await api('POST', `/acara/${acara.id}/sesi`, {
  token: adminSelatan,
  body: { nama: 'Sesi 1', mulai: iso(mulai, 2), selesai: iso(mulai, 1) },
});
check('sesi selesai < mulai → 400', sesiErr.status === 400);
let detail = (
  await api('POST', `/acara/${acara.id}/sesi`, {
    token: adminSelatan,
    body: { nama: 'Sesi 1', mulai: iso(mulai), selesai: iso(mulai, 2) },
  })
).json;
const sesi = detail.sesi[0];
check(
  'tambah sesi (batas izin default = mulai)',
  sesi?.toleransiMenit === 15 && sesi.batasIzin === sesi.mulai,
);
const pengisiAnggota = pesertaList.items[0];
for (const judul of ['Pembukaan', 'Tilawah', 'Materi'])
  detail = (
    await api('POST', `/sesi/${sesi.id}/rundown`, {
      token: adminSelatan,
      body: {
        judul,
        pengisi:
          judul === 'Materi'
            ? [{ namaBebas: 'Ust. Tamu', peran: 'pemateri' }]
            : pengisiAnggota
              ? [{ anggotaId: pengisiAnggota.id, peran: 'MC' }]
              : [],
      },
    })
  ).json;
let rd = detail.sesi[0].rundown;
check(
  'tambah 3 rundown berurutan + pengisi anggota',
  rd.map((r) => r.judul).join() === 'Pembukaan,Tilawah,Materi' &&
    (!pengisiAnggota || rd[0].pengisi[0].anggota?.nama === pengisiAnggota.nama),
);
detail = (
  await api('PUT', `/sesi/${sesi.id}/rundown/urutan`, {
    token: adminSelatan,
    body: { ids: [rd[2].id, rd[0].id, rd[1].id] },
  })
).json;
check(
  'geser urutan rundown',
  detail.sesi[0].rundown.map((r) => r.judul).join() === 'Materi,Pembukaan,Tilawah',
);
check(
  'urutan tidak lengkap → 400',
  (
    await api('PUT', `/sesi/${sesi.id}/rundown/urutan`, {
      token: adminSelatan,
      body: { ids: [rd[0].id] },
    })
  ).json.code === 'URUTAN_INVALID',
);
detail = (
  await api('PATCH', `/rundown/${rd[1].id}`, {
    token: adminSelatan,
    body: { judul: 'Tilawah Quran', pengisi: [{ namaBebas: 'Qori Tamu', peran: 'qori' }] },
  })
).json;
rd = detail.sesi[0].rundown;
const til = rd.find((r) => r.id === rd.find((x) => x.judul === 'Tilawah Quran')?.id);
check(
  'ubah rundown + ganti pengisi',
  til?.pengisi.length === 1 && til.pengisi[0].namaBebas === 'Qori Tamu',
);
check(
  'pengisi anggota tidak dikenal → 400',
  (
    await api('PATCH', `/rundown/${rd[0].id}`, {
      token: adminSelatan,
      body: { pengisi: [{ anggotaId: 'tidak-ada' }] },
    })
  ).json.code === 'PENGISI_INVALID',
);
detail = (await api('DELETE', `/rundown/${rd[0].id}`, { token: adminSelatan })).json;
check('hapus rundown', detail.sesi[0].rundown.length === 2);
check(
  'auditor tidak bisa ubah sesi',
  (await api('PATCH', `/sesi/${sesi.id}`, { token: auditor, body: { nama: 'x' } })).status === 403,
);
check(
  'cari anggota untuk pengisi',
  !pengisiAnggota ||
    (
      await api(
        'GET',
        `/anggota-ref/cari?q=${encodeURIComponent(pengisiAnggota.nama.slice(0, 4))}`,
        {
          token: adminSelatan,
        },
      )
    ).json.some((a) => a.id === pengisiAnggota.id),
);

// --- PJ
const users = (await core('GET', '/users', { token: sa })).json;
const uSel = users.find((u) => u.email === 'admin.selatan@platform-acara.local');
detail = (
  await api('POST', `/acara/${acara.id}/pj`, {
    token: adminSelatan,
    body: { userId: uSel.id, peran: 'PJ_UMUM' },
  })
).json;
check('tetapkan PJ (nama disalin dari core)', detail.pj?.[0]?.nama === uSel.nama);
detail = (await api('DELETE', `/acara/${acara.id}/pj/${detail.pj[0].id}`, { token: adminSelatan }))
  .json;
check('hapus PJ', detail.pj.length === 0);

// --- Riwayat acara anggota
if (pengisiAnggota) {
  const riw = await api('GET', `/anggota/${pengisiAnggota.id}/acara`, { token: adminSelatan });
  check('riwayat acara anggota', riw.status === 200 && riw.json.some((a) => a.id === acara.id));
}

// --- Foto
const png = await sharp({
  create: { width: 2400, height: 1200, channels: 3, background: '#3b82f6' },
})
  .png()
  .toBuffer();
const form = new FormData();
form.append('file', new Blob([png], { type: 'image/png' }), 'kegiatan.png');
form.append('caption', 'Suasana pengajian');
form.append('sesiId', sesi.id);
const up = await api('POST', `/acara/${acara.id}/foto`, { token: adminSelatan, form });
check(
  'unggah foto',
  up.status === 201 && up.json.caption === 'Suasana pengajian',
  JSON.stringify(up.json),
);
const full = await api('GET', `/foto/${up.json.id}/file`, { token: auditor });
const thumb = await api('GET', `/foto/${up.json.id}/file?thumb=1`, { token: auditor });
check(
  'foto dikonversi ke WebP + thumbnail lebih kecil',
  full.type === 'image/webp' && thumb.type === 'image/webp' && thumb.size < full.size,
);
const meta = await sharp(
  Buffer.from(
    await (
      await fetch(`${B}/foto/${up.json.id}/file`, { headers: { authorization: `Bearer ${sa}` } })
    ).arrayBuffer(),
  ),
).metadata();
check('foto diperkecil ke maks 1600 px', meta.width === 1600 && meta.height === 800);
const bad = new FormData();
bad.append('file', new Blob(['bukan gambar'], { type: 'text/plain' }), 'x.txt');
check(
  'file bukan gambar → 400',
  (await api('POST', `/acara/${acara.id}/foto`, { token: adminSelatan, form: bad })).json.code ===
    'FOTO_INVALID',
);
check(
  'daftar foto',
  (await api('GET', `/acara/${acara.id}/foto`, { token: auditor })).json.length === 1,
);
check(
  'hapus foto',
  (await api('DELETE', `/foto/${up.json.id}`, { token: adminSelatan })).status === 204,
);
check(
  'foto terhapus tidak bisa dibuka',
  (await api('GET', `/foto/${up.json.id}/file`, { token: sa })).status === 404,
);

// --- Sinkron anggota dari core (event)
const anggotaKel1 = (
  await core('GET', `/anggota?kelompokId=${kel1.id}&status=AKTIF&pageSize=1`, { token: sa })
).json.items[0];
const punyaLansia = anggotaKel1.kategori.some((k) => k.kode === 'LANSIA');
const lansia = kategori.find((k) => k.kode === 'LANSIA');
const kategoriBaru = punyaLansia
  ? anggotaKel1.kategori.filter((k) => k.kode !== 'LANSIA').map((k) => k.id)
  : [...anggotaKel1.kategori.map((k) => k.id), lansia.id];
const pvLansia = () =>
  api('POST', '/acara/peserta/preview', {
    token: sa,
    body: {
      tingkat: 'KELOMPOK',
      wilayah: [{ level: 'KELOMPOK', id: kel1.id }],
      kategori: ['LANSIA'],
    },
  }).then((r) => r.json.total);
const sebelum = await pvLansia();
await core('PATCH', `/anggota/${anggotaKel1.id}`, {
  token: sa,
  body: { kategoriIds: kategoriBaru },
});
check(
  'ubah kategori anggota di core → peserta acara ikut berubah',
  await waitFor(async () => (await pvLansia()) === sebelum + (punyaLansia ? -1 : 1)),
);

// --- Perangkat pintu (operator) & absensi offline
const gen = await api('POST', `/sesi/${sesi.id}/operator/generate`, {
  token: adminSelatan,
  body: { jumlah: 2 },
});
const [pintu1, pintu2] = gen.json.items ?? [];
check(
  'admin membuat 2 pintu dengan kode, PIN 6 angka, dan QR',
  gen.status === 201 &&
    pintu1?.label === 'Pintu 1' &&
    pintu2?.label === 'Pintu 2' &&
    /^[A-Z0-9]{6}$/.test(pintu1.kode) &&
    /^\d{6}$/.test(pintu1.pin) &&
    pintu1.url.startsWith('/op/login?t='),
  JSON.stringify(gen.json).slice(0, 300),
);
check(
  'auditor tidak bisa membuat pintu',
  (
    await api('POST', `/sesi/${sesi.id}/operator/generate`, {
      token: auditor,
      body: { jumlah: 1 },
    })
  ).status === 403,
);
check(
  'jumlah pintu di luar batas → 400',
  (
    await api('POST', `/sesi/${sesi.id}/operator/generate`, {
      token: adminSelatan,
      body: { jumlah: 0 },
    })
  ).status === 400,
);
const qr1 = pintu1.url.split('t=')[1];
const opLogin = await api('POST', '/op/login', {
  body: { token: qr1, perangkat: 'e2e' },
});
const opToken = opLogin.json.token;
check(
  'perangkat login dengan token QR',
  opLogin.status === 200 && !!opToken && opLogin.json.operator.label === 'Pintu 1',
);
check(
  'token QR sekali pakai',
  (await api('POST', '/op/login', { body: { token: qr1 } })).json.code === 'QR_USED',
);
check(
  'paket tanpa token operator → 401',
  (await api('GET', '/op/paket', { token: sa })).status === 401,
);
const paket = (await api('GET', '/op/paket', { token: opToken })).json;
check(
  'paket berisi peserta sesi tanpa data pribadi',
  paket.peserta?.length === upd.json.jumlahPeserta &&
    paket.peserta.every((p) => Object.keys(p).sort().join() === 'id,kelompok,kode,nama') &&
    Array.isArray(paket.wajah) &&
    paket.threshold === 0.5,
  JSON.stringify(paket).slice(0, 200),
);
const N = Math.min(30, paket.peserta.length);
const t0 = Date.now();
const items = paket.peserta.slice(0, N).map((p, i) => ({
  clientId: crypto.randomUUID(),
  metode: 'MANUAL',
  anggotaId: p.id,
  capturedAt: new Date(t0 + i * 1000).toISOString(),
}));
const tamuItem = {
  clientId: crypto.randomUUID(),
  metode: 'TAMU',
  nama: 'Tamu Uji',
  capturedAt: new Date(t0).toISOString(),
};
const b1 = (
  await api('POST', '/op/absensi/batch', { token: opToken, body: { items: [...items, tamuItem] } })
).json;
check(`kirim ${N} absensi + 1 tamu`, b1.ringkas?.baru === N + 1, JSON.stringify(b1.ringkas));
const b2 = (
  await api('POST', '/op/absensi/batch', { token: opToken, body: { items: [...items, tamuItem] } })
).json;
check(
  'kirim ulang batch yang sama tidak dobel',
  b2.ringkas?.sudahDiterima === N + 1 && b2.ringkas.baru === 0,
);
const pinLogin = await api('POST', '/op/login', {
  body: { kode: pintu2.kode.toLowerCase(), pin: pintu2.pin },
});
const op2 = pinLogin.json.token;
check(
  'login dengan kode pintu + PIN (huruf kecil diterima)',
  pinLogin.status === 200 && pinLogin.json.operator.label === 'Pintu 2',
);
check(
  'PIN salah → 401 PIN_INVALID',
  (await api('POST', '/op/login', { body: { kode: pintu2.kode, pin: '000000' } })).json.code ===
    'PIN_INVALID' || pintu2.pin === '000000',
);
const b3 = (
  await api('POST', '/op/absensi/batch', {
    token: op2,
    body: {
      items: [
        {
          clientId: crypto.randomUUID(),
          metode: 'MANUAL',
          anggotaId: items[0].anggotaId,
          capturedAt: new Date(t0 - 60_000).toISOString(),
        },
        {
          clientId: crypto.randomUUID(),
          metode: 'MANUAL',
          anggotaId: items[1].anggotaId,
          capturedAt: new Date(t0 + 60_000).toISOString(),
        },
        {
          clientId: crypto.randomUUID(),
          metode: 'MANUAL',
          anggotaId: 'bukan-peserta',
          capturedAt: new Date(t0).toISOString(),
        },
      ],
    },
  })
).json;
check(
  'pintu lain: scan lebih awal menggantikan, scan lebih akhir jadi duplikat, bukan peserta ditolak',
  b3.hasil
    ?.map((h) => h.status)
    .sort()
    .join() === 'DITOLAK,DUPLIKAT,LEBIH_AWAL',
  JSON.stringify(b3.hasil),
);
const kh = (await api('GET', `/sesi/${sesi.id}/kehadiran`, { token: auditor })).json;
const pertama = kh.items?.find((i) => i.anggota?.id === items[0].anggotaId);
check(
  'kehadiran sesi: jumlah hadir, tamu, waktu paling awal, pintu',
  kh.hadir === N &&
    kh.tamu === 1 &&
    pertama?.pintu === 'Pintu 2' &&
    new Date(pertama.capturedAt).getTime() === t0 - 60_000 &&
    kh.operator.length === 2,
  JSON.stringify({ hadir: kh.hadir, tamu: kh.tamu, pertama }),
);
check(
  'paket berikutnya menandai yang sudah hadir',
  (await api('GET', '/op/paket', { token: opToken })).json.sudahHadir.length === N,
);
check(
  'batch tidak valid → 400',
  (
    await api('POST', '/op/absensi/batch', {
      token: opToken,
      body: { items: [{ metode: 'MANUAL' }] },
    })
  ).status === 400,
);

// --- Pintu: heartbeat, monitor, kunci PIN, reset, cabut
const hb = await api('POST', '/op/heartbeat', {
  token: opToken,
  body: { online: true, sedangInput: false, antrean: 3, baterai: 80 },
});
check('heartbeat perangkat', hb.status === 200);
check(
  'heartbeat tanpa token operator → 401',
  (await api('POST', '/op/heartbeat', { body: { online: true } })).status === 401,
);
let daftar = (await api('GET', `/sesi/${sesi.id}/operator`, { token: auditor })).json;
const p1 = daftar.pintu?.find((p) => p.label === 'Pintu 1');
check(
  'daftar pintu: status, antrean, baterai, jumlah input',
  daftar.pintu?.length === 2 &&
    p1?.status === 'ONLINE' &&
    p1.antrean === 3 &&
    p1.baterai === 80 &&
    p1.jumlahInput === N + 1 &&
    p1.qrDipakai === true &&
    daftar.hadir === N &&
    !('pin' in p1) &&
    !('pinHash' in p1),
  JSON.stringify(daftar).slice(0, 400),
);
// SSE: baca event pertama
const ctl = new AbortController();
const sse = await fetch(`${B}/sesi/${sesi.id}/monitor`, {
  headers: { authorization: `Bearer ${auditor}` },
  signal: ctl.signal,
});
let first = '';
const reader = sse.body.getReader();
while (!first.includes('\n\n')) first += new TextDecoder().decode((await reader.read()).value);
ctl.abort();
const ev = JSON.parse(first.split('data: ')[1].split('\n')[0]);
check(
  'monitor SSE mengirim kondisi pintu',
  sse.headers.get('content-type')?.startsWith('text/event-stream') && ev.pintu?.length === 2,
  first.slice(0, 200),
);
check('monitor tanpa login → 401', (await fetch(`${B}/sesi/${sesi.id}/monitor`)).status === 401);
const [pintu3] = (
  await api('POST', `/sesi/${sesi.id}/operator/generate`, {
    token: adminSelatan,
    body: { jumlah: 1 },
  })
).json.items;
check('pintu berikutnya bernomor lanjut', pintu3?.label === 'Pintu 3');
const pinSalah = pintu3.pin === '111111' ? '222222' : '111111';
for (let i = 0; i < 5; i++)
  await api('POST', '/op/login', { body: { kode: pintu3.kode, pin: pinSalah } });
check(
  '5 PIN salah mengunci pintu sementara',
  (await api('POST', '/op/login', { body: { kode: pintu3.kode, pin: pintu3.pin } })).json.code ===
    'PIN_TERKUNCI',
);
const reset = await api('POST', `/operator/${pintu3.id}/reset-pin`, { token: adminSelatan });
check(
  'reset PIN membuka kunci, PIN lama tidak berlaku',
  reset.status === 200 &&
    (reset.json.pin === pintu3.pin ||
      (await api('POST', '/op/login', { body: { kode: pintu3.kode, pin: pintu3.pin } })).status ===
        401),
);
const op3 = (await api('POST', '/op/login', { body: { kode: pintu3.kode, pin: reset.json.pin } }))
  .json.token;
check('login dengan PIN baru', !!op3);
check(
  'QR baru dari reset bisa dipakai',
  (await api('POST', '/op/login', { body: { token: reset.json.url.split('t=')[1] } })).status ===
    200,
);
check(
  'auditor tidak bisa mencabut pintu',
  (await api('POST', `/operator/${pintu3.id}/revoke`, { token: auditor })).status === 403,
);
check(
  'cabut pintu',
  (await api('POST', `/operator/${pintu3.id}/revoke`, { token: adminSelatan })).status === 200,
);
check(
  'perangkat yang dicabut langsung ditolak',
  (await api('GET', '/op/paket', { token: op3 })).json.code === 'OPERATOR_DICABUT',
);
check(
  'pintu dicabut tidak bisa login lagi',
  (await api('POST', '/op/login', { body: { kode: pintu3.kode, pin: reset.json.pin } })).status ===
    401,
);
daftar = (await api('GET', `/sesi/${sesi.id}/operator`, { token: adminSelatan })).json;
check(
  'status pintu: dicabut & belum ada scan (idle)',
  daftar.pintu.find((p) => p.id === pintu3.id)?.status === 'DICABUT' &&
    daftar.pintu.find((p) => p.label === 'Pintu 2')?.status === 'ONLINE',
  JSON.stringify(daftar.pintu.map((p) => [p.label, p.status])),
);

// --- Pendaftaran wajah dari pintu & verifikasi admin
{
  const thumbB64 = (
    await sharp({ create: { width: 160, height: 160, channels: 3, background: '#a87' } })
      .webp()
      .toBuffer()
  ).toString('base64');
  const vektor = (s) =>
    Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 128 }, (_, j) => Math.sin(s * 7 + i * 0.01 + j) * 0.1),
    );
  const enrollBody = (anggotaId, s) => ({
    clientId: crypto.randomUUID(),
    anggotaId,
    descriptors: vektor(s),
    thumbnails: Array(5).fill(`data:image/webp;base64,${thumbB64}`),
    capturedAt: new Date().toISOString(),
  });
  const [wA, wB, wC] = paket.peserta.slice(0, 3);
  const eA = enrollBody(wA.id, 1);
  const en1 = await api('POST', '/op/face/enroll', { token: op2, body: eA });
  check(
    'pintu mendaftarkan wajah (5 embedding + 5 thumbnail) → PENDING',
    en1.status === 200 && en1.json.status === 'PENDING' && en1.json.baru === true,
    JSON.stringify(en1.json),
  );
  const en1b = await api('POST', '/op/face/enroll', { token: op2, body: eA });
  check('kirim ulang pendaftaran tidak dobel', en1b.json.id === en1.json.id && !en1b.json.baru);
  check(
    'pendaftaran wajah tanpa token operator → 401',
    (await api('POST', '/op/face/enroll', { token: sa, body: enrollBody(wA.id, 1) })).status ===
      401,
  );
  check(
    'pendaftaran wajah bukan peserta → 400',
    (await api('POST', '/op/face/enroll', { token: op2, body: enrollBody('bukan-peserta', 1) }))
      .json.code === 'BUKAN_PESERTA',
  );
  check(
    'pendaftaran wajah dengan 4 pose → 400',
    (
      await api('POST', '/op/face/enroll', {
        token: op2,
        body: { ...enrollBody(wA.id, 1), descriptors: vektor(1).slice(0, 4) },
      })
    ).status === 400,
  );
  const en2 = await api('POST', '/op/face/enroll', { token: op2, body: enrollBody(wB.id, 2) });
  const en3 = await api('POST', '/op/face/enroll', { token: op2, body: enrollBody(wC.id, 3) });
  const pk2 = (await api('GET', '/op/paket', { token: opToken })).json;
  check(
    'wajah PENDING langsung ada di paket pintu lain',
    [en1, en2, en3].every((e) =>
      pk2.wajah.some(
        (w) => w.id === e.json.id && w.status === 'PENDING' && w.descriptors.length === 5,
      ),
    ),
  );
  // Absensi WAJAH yang dibuat sebelum id server diketahui memakai clientId.
  const sesiW = (
    await api('POST', `/acara/${acara.id}/sesi`, {
      token: adminSelatan,
      body: { nama: 'Sesi Wajah', mulai: iso(mulai, 3), selesai: iso(mulai, 4) },
    })
  ).json.sesi.find((x) => x.nama === 'Sesi Wajah');
  const genW = await api('POST', `/sesi/${sesiW.id}/operator/generate`, {
    token: adminSelatan,
    body: { jumlah: 1 },
  });
  const opW = (
    await api('POST', '/op/login', { body: { token: genW.json.items[0].url.split('t=')[1] } })
  ).json.token;
  const absW = await api('POST', '/op/absensi/batch', {
    token: opW,
    body: {
      items: [wA, wB].map((w, i) => ({
        clientId: crypto.randomUUID(),
        metode: 'WAJAH',
        anggotaId: w.id,
        faceDataId: i === 0 ? eA.clientId : en2.json.id,
        faceDistance: 0.3,
        capturedAt: new Date().toISOString(),
      })),
    },
  });
  let khW = (await api('GET', `/sesi/${sesiW.id}/kehadiran`, { token: adminSelatan })).json;
  check(
    'absensi dengan wajah PENDING ditandai (wajahPending) tanpa perluTinjau',
    absW.json.ringkas?.baru === 2 &&
      khW.items?.length === 2 &&
      khW.items.every((i) => i.wajahPending && !i.perluTinjau),
    JSON.stringify(khW.items ?? khW),
  );
  const pend = await api('GET', '/face/pending?pageSize=200', { token: adminSelatan });
  const p1 = pend.json.items?.find((f) => f.id === en1.json.id);
  check(
    'admin desa melihat daftar wajah PENDING lengkap dengan pintu & sesi',
    pend.status === 200 &&
      p1?.anggota.id === wA.id &&
      p1.jumlahThumbnail === 5 &&
      p1.pintu === 'Pintu 2' &&
      p1.sesi?.nama === sesi.nama,
    JSON.stringify(p1 ?? pend.json),
  );
  const jml = (await api('GET', '/face/pending/jumlah', { token: adminSelatan })).json.jumlah;
  check('jumlah wajah PENDING', jml >= 3);
  const anggotaUtara = (await core('GET', `/anggota?desaId=${utara.id}&pageSize=1`, { token: sa }))
    .json.items[0];
  check(
    'ganti ke anggota di luar wilayah admin → 403',
    (
      await api('POST', `/face/${en3.json.id}/reassign`, {
        token: adminSelatan,
        body: { anggotaId: anggotaUtara.id },
      })
    ).status === 403,
  );
  const th = await api('GET', `/face/${en1.json.id}/thumb/4`, { token: auditor });
  check('thumbnail wajah WebP', th.status === 200 && th.type.startsWith('image/webp'));
  check(
    'auditor tidak bisa menyetujui wajah',
    (await api('POST', `/face/${en1.json.id}/verify`, { token: auditor })).status === 403,
  );
  // SSE badge
  {
    const ctl = new AbortController();
    const r = await fetch(`${B}/face/pending/stream`, {
      headers: { authorization: `Bearer ${adminSelatan}` },
      signal: ctl.signal,
    });
    const reader = r.body.getReader();
    let buf = '';
    while (!buf.includes('\n\n')) buf += new TextDecoder().decode((await reader.read()).value);
    ctl.abort();
    check(
      'badge SSE jumlah wajah perlu verifikasi',
      JSON.parse(buf.split('data:')[1]).jumlah === jml,
      buf,
    );
  }
  const v1 = await api('POST', `/face/${en1.json.id}/verify`, { token: adminSelatan });
  check('setujui wajah → VERIFIED', v1.status === 200 && v1.json.status === 'VERIFIED');
  check(
    'wajah yang sudah diputus tidak bisa diputus lagi',
    (await api('POST', `/face/${en1.json.id}/reject`, { token: adminSelatan, body: {} })).status ===
      409,
  );
  const r2 = await api('POST', `/face/${en2.json.id}/reject`, {
    token: adminSelatan,
    body: { alasan: 'Bukan orangnya' },
  });
  check(
    'tolak wajah → REJECTED, absensi yang memakainya ditandai perlu ditinjau',
    r2.status === 200 && r2.json.status === 'REJECTED' && r2.json.absensiDitandai === 1,
    JSON.stringify(r2.json),
  );
  const det2 = (await api('GET', `/face/${en2.json.id}`, { token: adminSelatan })).json;
  check(
    'wajah ditolak: thumbnail & embedding dihapus',
    det2.status === 'REJECTED' &&
      det2.jumlahThumbnail === 0 &&
      (await api('GET', `/face/${en2.json.id}/thumb/0`, { token: adminSelatan })).status === 404,
  );
  const pk3 = (await api('GET', '/op/paket', { token: opToken })).json;
  check(
    'paket: wajah ditolak keluar, wajah disetujui jadi VERIFIED',
    !pk3.wajah.some((w) => w.id === en2.json.id) &&
      pk3.wajah.find((w) => w.id === en1.json.id)?.status === 'VERIFIED',
  );
  khW = (await api('GET', `/sesi/${sesiW.id}/kehadiran`, { token: adminSelatan })).json;
  check(
    'kehadiran: wajah disetujui tidak lagi kuning, wajah ditolak perlu ditinjau',
    khW.items.find((i) => i.anggota.id === wA.id)?.wajahPending === false &&
      khW.items.find((i) => i.anggota.id === wB.id)?.perluTinjau === true,
  );
  const g3 = await api('POST', `/face/${en3.json.id}/reassign`, {
    token: adminSelatan,
    body: { anggotaId: wA.id },
  });
  const det3 = (await api('GET', `/face/${en3.json.id}`, { token: adminSelatan })).json;
  check(
    'ganti anggota: wajah pindah ke anggota benar & VERIFIED, ada pembanding wajah sebelumnya',
    g3.status === 200 &&
      det3.anggota.id === wA.id &&
      det3.status === 'VERIFIED' &&
      det3.sebelumnya.some((s) => s.id === en1.json.id),
    JSON.stringify(det3).slice(0, 300),
  );
  check(
    'jumlah PENDING berkurang 3',
    (await api('GET', '/face/pending/jumlah', { token: adminSelatan })).json.jumlah === jml - 3,
  );
}

// --- Rekap: tutup sesi, izin, susulan, hitung ulang, ekspor
{
  const now = Date.now();
  const at = (ms) => new Date(ms).toISOString();
  const acR = (
    await api('POST', '/acara', {
      token: adminSelatan,
      body: {
        nama: `Rekap Uji ${now % 100000}`,
        jenis: 'Pengajian desa',
        tanggalMulai: at(now - 6 * 36e5),
        tanggalSelesai: at(now + 4 * 36e5),
        tingkat: 'DESA',
        wilayah: [{ level: 'DESA', id: selatan.id }],
      },
    })
  ).json;
  const mulaiA = now - 3 * 36e5;
  await api('POST', `/acara/${acR.id}/sesi`, {
    token: adminSelatan,
    body: { nama: 'Sesi A', mulai: at(mulaiA), selesai: at(now - 36e5), toleransiMenit: 15 },
  });
  await api('POST', `/acara/${acR.id}/sesi`, {
    token: adminSelatan,
    body: { nama: 'Sesi B', mulai: at(now - 2 * 36e5), selesai: at(now + 36e5) },
  });
  const detR = (
    await api('POST', `/acara/${acR.id}/sesi`, {
      token: adminSelatan,
      body: { nama: 'Sesi C', mulai: at(now + 2 * 36e5), selesai: at(now + 3 * 36e5) },
    })
  ).json;
  const [sA, sB, sC] = ['Sesi A', 'Sesi B', 'Sesi C'].map((n) =>
    detR.sesi.find((x) => x.nama === n),
  );
  const pintuA = (
    await api('POST', `/sesi/${sA.id}/operator/generate`, {
      token: adminSelatan,
      body: { jumlah: 1 },
    })
  ).json.items[0];
  const opA = (await api('POST', '/op/login', { body: { token: pintuA.url.split('t=')[1] } })).json
    .token;
  const pk = (await api('GET', '/op/paket', { token: opA })).json;
  const P = pk.peserta;
  check(
    'acara rekap punya cukup peserta',
    P.length >= 10 && P.length === acR.jumlahPeserta,
    String(P.length),
  );
  const absen = (p, ms) => ({
    clientId: crypto.randomUUID(),
    metode: 'MANUAL',
    anggotaId: p.id,
    capturedAt: at(ms),
  });
  await api('POST', '/op/absensi/batch', {
    token: opA,
    body: { items: [absen(P[0], mulaiA + 5 * 6e4), absen(P[1], mulaiA + 30 * 6e4)] },
  });
  // Izin lewat event dari wabot (fase 7): kirim langsung ke queue acara.
  const { Queue } = await import('bullmq');
  const q = new Queue('acara-events', {
    connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
  });
  const izin = async (p, kategori, sesiId, status) => {
    const izinId = `iz-${crypto.randomUUID()}`;
    await q.add('izin.submitted', {
      izinId,
      anggotaId: p.id,
      acaraId: acR.id,
      ...(sesiId ? { sesiId } : {}),
      kategori,
      alasan: 'uji',
    });
    await q.add('izin.decided', {
      izinId,
      status,
      decidedBy: 'pengurus',
      decidedAt: at(Date.now()),
    });
  };
  await izin(P[2], 'SAKIT', sA.id, 'APPROVED');
  await izin(P[3], 'IZIN', null, 'APPROVED');
  await izin(P[4], 'IZIN', sA.id, 'REJECTED');
  const statusDi = (r, p) => r.items?.find((i) => i.anggota.id === p.id)?.status;
  let rA;
  await waitFor(async () => {
    rA = (await api('GET', `/sesi/${sA.id}/rekap`, { token: adminSelatan })).json;
    return statusDi(rA, P[2]) === 'SAKIT' && statusDi(rA, P[3]) === 'IZIN';
  }, 15000);
  check(
    'rekap sementara: hadir, terlambat, sakit & izin dari event, izin ditolak = alpha',
    rA.final === false &&
      statusDi(rA, P[0]) === 'HADIR' &&
      rA.items.find((i) => i.anggota.id === P[1].id)?.terlambat === true &&
      statusDi(rA, P[2]) === 'SAKIT' &&
      statusDi(rA, P[3]) === 'IZIN' &&
      statusDi(rA, P[4]) === 'ALPHA' &&
      rA.ringkas.peserta === P.length &&
      rA.ringkas.HADIR === 2 &&
      rA.ringkas.ALPHA === P.length - 4,
    JSON.stringify(rA.ringkas),
  );
  check(
    'auditor tidak bisa menutup sesi',
    (await api('POST', `/sesi/${sA.id}/tutup`, { token: auditor })).status === 403,
  );
  check(
    'sesi yang belum mulai tidak bisa ditutup',
    (await api('POST', `/sesi/${sC.id}/tutup`, { token: adminSelatan })).json.code ===
      'SESI_BELUM_MULAI',
  );
  const tA = await api('POST', `/sesi/${sA.id}/tutup`, { token: adminSelatan });
  check(
    'tutup sesi → rekap final sama dengan data uji',
    tA.status === 200 &&
      tA.json.final &&
      tA.json.sesi.status === 'DITUTUP' &&
      JSON.stringify(tA.json.ringkas) === JSON.stringify(rA.ringkas),
    JSON.stringify(tA.json.ringkas),
  );
  check(
    'tutup dua kali → 409',
    (await api('POST', `/sesi/${sA.id}/tutup`, { token: adminSelatan })).status === 409,
  );
  const sus = await api('POST', `/sesi/${sA.id}/absensi`, {
    token: adminSelatan,
    body: { anggotaId: P[5].id, catatan: 'Lupa scan' },
  });
  check(
    'absensi susulan admin masuk rekap final',
    sus.status === 200 &&
      statusDi(sus.json, P[5]) === 'HADIR' &&
      sus.json.items.find((i) => i.anggota.id === P[5].id).susulan,
  );
  check(
    'susulan untuk yang sudah hadir → 409, bukan peserta → 400',
    (
      await api('POST', `/sesi/${sA.id}/absensi`, {
        token: adminSelatan,
        body: { anggotaId: P[0].id },
      })
    ).status === 409 &&
      (
        await api('POST', `/sesi/${sA.id}/absensi`, {
          token: adminSelatan,
          body: { anggotaId: 'bukan' },
        })
      ).status === 400,
  );
  await izin(P[6], 'SAKIT', null, 'APPROVED');
  check(
    'izin yang diputuskan setelah sesi ditutup ikut mengubah rekap',
    await waitFor(
      async () =>
        statusDi((await api('GET', `/sesi/${sA.id}/rekap`, { token: adminSelatan })).json, P[6]) ===
        'SAKIT',
      15000,
    ),
  );
  await api('POST', '/op/absensi/batch', {
    token: opA,
    body: { items: [absen(P[7], mulaiA + 10 * 6e4)] },
  });
  rA = (await api('GET', `/sesi/${sA.id}/rekap`, { token: adminSelatan })).json;
  check(
    'absensi offline yang tersinkron setelah ditutup ikut masuk',
    statusDi(rA, P[7]) === 'HADIR',
  );
  const hu = await api('POST', `/sesi/${sA.id}/rekap/hitung-ulang`, { token: adminSelatan });
  check(
    'hitung ulang tidak mengubah hasil',
    hu.status === 200 && JSON.stringify(hu.json.ringkas) === JSON.stringify(rA.ringkas),
  );
  check(
    'hitung ulang sesi yang belum ditutup → 400',
    (await api('POST', `/sesi/${sB.id}/rekap/hitung-ulang`, { token: adminSelatan })).json.code ===
      'SESI_BELUM_DITUTUP',
  );
  const kelX = rA.items[0].anggota.kelompok;
  const rK = (await api('GET', `/sesi/${sA.id}/rekap?kelompokId=${kelX.id}`, { token: auditor }))
    .json;
  check(
    'filter per kelompok (auditor boleh melihat)',
    rK.items.length > 0 &&
      rK.items.every((i) => i.anggota.kelompok.id === kelX.id) &&
      rK.ringkas.peserta === rA.perKelompok.find((k) => k.id === kelX.id).peserta,
  );
  const xl = await fetch(`${B}/sesi/${sA.id}/rekap.xlsx`, {
    headers: { authorization: `Bearer ${adminSelatan}` },
  });
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await xl.arrayBuffer());
  const ws = wb.getWorksheet('Rekap');
  const statusXl = [];
  for (let r = 7; r <= ws.rowCount; r++) statusXl.push(ws.getRow(r).getCell(7).value);
  check(
    'ekspor Excel sesi: semua peserta dengan status yang sama',
    xl.status === 200 &&
      (xl.headers.get('content-disposition') ?? '').includes('.xlsx') &&
      statusXl.length === rA.items.length &&
      statusXl.filter((s) => s === 'HADIR').length === rA.ringkas.HADIR &&
      !!wb.getWorksheet('Per kelompok'),
    `${xl.status} ${statusXl.length}`,
  );
  const rAc = (await api('GET', `/acara/${acR.id}/rekap`, { token: adminSelatan })).json;
  const baris0 = rAc.anggota?.find((a) => a.anggota.id === P[3].id);
  check(
    'rekap acara: matriks anggota × sesi, izin seluruh acara berlaku di semua sesi',
    rAc.sesi?.length === 3 &&
      rAc.sesi[0].final &&
      !rAc.sesi[1].final &&
      baris0?.status.join() === 'IZIN,IZIN,IZIN' &&
      rAc.anggota.length === P.length,
    JSON.stringify(baris0),
  );
  const xa = await fetch(`${B}/acara/${acR.id}/rekap.xlsx?desaId=${selatan.id}`, {
    headers: { authorization: `Bearer ${adminSelatan}` },
  });
  check(
    'ekspor Excel acara per desa',
    xa.status === 200 && (await xa.arrayBuffer()).byteLength > 1000,
  );
  const riw = (await api('GET', `/anggota/${P[0].id}/kehadiran`, { token: adminSelatan })).json;
  check(
    'riwayat kehadiran anggota dari sesi yang sudah ditutup',
    riw.items?.some((i) => i.sesi.id === sA.id && i.status === 'HADIR') &&
      !riw.items.some((i) => i.sesi.id === sB.id),
  );
  const dk = (await api('GET', '/dashboard/kehadiran', { token: adminSelatan })).json;
  check(
    'dashboard kehadiran: sesi terbaru & per bulan',
    dk.sesiTerbaru?.some((s) => s.id === sA.id && s.ringkas.peserta === rA.ringkas.peserta) &&
      dk.perBulan?.length === 6 &&
      dk.perKategori?.length > 0,
    JSON.stringify(dk).slice(0, 300),
  );
  await q.close();
}

// --- Statistik dashboard
const dSel = await api('GET', '/dashboard/acara', { token: adminSelatan });
const dSa = (await api('GET', '/dashboard/acara', { token: sa })).json;
check(
  'statistik acara sesuai wilayah',
  dSel.status === 200 &&
    dSel.json.perBulan.length === 12 &&
    dSel.json.total >= 2 &&
    dSa.total >= dSel.json.total &&
    Object.values(dSel.json.status).reduce((a, b) => a + b, 0) === dSel.json.total,
  JSON.stringify(dSel.json).slice(0, 200),
);
check(
  'auditor bisa melihat statistik acara',
  (await api('GET', '/dashboard/acara', { token: auditor })).status === 200,
);

// --- Hapus (soft)
check(
  'hapus acara',
  (await api('DELETE', `/acara/${acara.id}`, { token: adminSelatan })).status === 204,
);
check(
  'acara terhapus → 404',
  (await api('GET', `/acara/${acara.id}`, { token: sa })).status === 404,
);
check(
  'acara terhapus tidak ada di daftar',
  !(await api('GET', '/acara?pageSize=100', { token: sa })).json.items.some(
    (a) => a.id === acara.id,
  ),
);

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
