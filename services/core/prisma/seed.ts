/**
 * Data awal dev: 1 SUPER_ADMIN, 1 daerah, 2 desa, 4 kelompok, 40 anggota dummy.
 * Idempoten: aman dijalankan berulang (`pnpm --filter @platform-acara/core db:seed`).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { type KategoriGenerus, PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? 'admin@platform-acara.local').toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';

const WILAYAH = {
  daerah: { kode: 'DC', nama: 'Daerah Contoh' },
  desa: [
    { kode: 'JS', nama: 'Desa Selatan', kelompok: ['Kelompok Melati', 'Kelompok Mawar'] },
    { kode: 'JU', nama: 'Desa Utara', kelompok: ['Kelompok Anggrek', 'Kelompok Kenanga'] },
  ],
};

const NAMA_L = [
  'Ahmad',
  'Budi',
  'Fajar',
  'Hasan',
  'Ilham',
  'Rizki',
  'Yusuf',
  'Zaki',
  'Dimas',
  'Arif',
];
const NAMA_P = [
  'Aisyah',
  'Fatimah',
  'Nisa',
  'Salma',
  'Zahra',
  'Laila',
  'Rania',
  'Dewi',
  'Putri',
  'Hana',
];
const NAMA_B = [
  'Pratama',
  'Hidayat',
  'Saputra',
  'Lestari',
  'Rahmawati',
  'Nugroho',
  'Wibowo',
  'Kurnia',
];

/** Contoh hasil assessment; sebagian sengaja kosong (belum di-assessment). */
const KATEGORI_DUMMY: (KategoriGenerus | null)[] = [
  'CABERAWIT',
  'PRAREMAJA',
  'REMAJA',
  'USIA_NIKAH',
  'REMAJA',
  null,
];

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      nama: 'Super Admin',
      role: 'SUPER_ADMIN',
      passwordHash: await argon2.hash(ADMIN_PASSWORD, { type: argon2.argon2id }),
    },
    update: {},
  });

  const daerah = await prisma.daerah.upsert({
    where: { kode: WILAYAH.daerah.kode },
    create: WILAYAH.daerah,
    update: {},
  });

  let n = 0;
  for (const d of WILAYAH.desa) {
    const desa = await prisma.desa.upsert({
      where: { kode: d.kode },
      create: { kode: d.kode, nama: d.nama, daerahId: daerah.id },
      update: {},
    });
    for (const [ki, namaKel] of d.kelompok.entries()) {
      const kelompok = await prisma.kelompok.upsert({
        where: { kode: `${d.kode}-K${ki + 1}` },
        create: { kode: `${d.kode}-K${ki + 1}`, nama: namaKel, desaId: desa.id },
        update: {},
      });
      for (let i = 0; i < 10; i++, n++) {
        const urut = ki * 10 + i + 1;
        const kode = `${d.kode}-${String(urut).padStart(4, '0')}`;
        const jk = n % 2 === 0 ? 'L' : 'P';
        const depan = (jk === 'L' ? NAMA_L : NAMA_P)[n % 10]!;
        const nama = `${depan} ${NAMA_B[n % NAMA_B.length]!}`;
        const tahun = 2006 + (n % 14);
        const anggota = await prisma.anggota.upsert({
          where: { kode },
          create: {
            kode,
            nama,
            jenisKelamin: jk,
            tanggalLahir: new Date(Date.UTC(tahun, n % 12, (n % 27) + 1)),
            kategori: KATEGORI_DUMMY[n % KATEGORI_DUMMY.length],
            noWa: tahun <= 2008 ? `62812${String(10000000 + n).padStart(8, '0')}` : null,
            kelompokId: kelompok.id,
          },
          update: {},
        });
        if (tahun > 2008) {
          const noWa = `62813${String(20000000 + n).padStart(8, '0')}`;
          const wali = await prisma.wali.upsert({
            where: { noWa },
            create: { noWa, nama: `Bapak ${NAMA_B[n % NAMA_B.length]!}` },
            update: {},
          });
          await prisma.anggotaWali.upsert({
            where: { anggotaId_waliId: { anggotaId: anggota.id, waliId: wali.id } },
            create: { anggotaId: anggota.id, waliId: wali.id, hubungan: 'AYAH' },
            update: {},
          });
        }
      }
    }
    // Lanjutkan nomor urut setelah data seed.
    const last = d.kelompok.length * 10;
    await prisma.kodeCounter.upsert({
      where: { desaId: desa.id },
      create: { desaId: desa.id, last },
      update: {},
    });
  }

  console.log(
    `Seed selesai. Login: ${admin.email} / ${process.env.SEED_ADMIN_PASSWORD ? '(SEED_ADMIN_PASSWORD)' : ADMIN_PASSWORD}`,
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
