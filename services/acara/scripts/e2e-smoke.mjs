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
const uji = await api('POST', `/sesi/${sesi.id}/operator/uji`, { token: adminSelatan });
check(
  'admin membuat akses perangkat uji',
  uji.status === 201 && uji.json.url.startsWith('/op/login?t='),
);
check(
  'auditor tidak bisa membuat akses perangkat',
  (await api('POST', `/sesi/${sesi.id}/operator/uji`, { token: auditor })).status === 403,
);
const opLogin = await api('POST', '/op/login', {
  body: { token: uji.json.token, perangkat: 'e2e' },
});
const opToken = opLogin.json.token;
check(
  'perangkat login dengan token QR',
  opLogin.status === 200 && !!opToken && opLogin.json.operator.label === 'Pintu 1',
);
check(
  'token QR sekali pakai',
  (await api('POST', '/op/login', { body: { token: uji.json.token } })).json.code === 'QR_USED',
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
const uji2 = (await api('POST', `/sesi/${sesi.id}/operator/uji`, { token: adminSelatan })).json;
const op2 = (await api('POST', '/op/login', { body: { token: uji2.token } })).json.token;
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
