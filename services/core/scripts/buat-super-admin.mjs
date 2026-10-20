/**
 * Membuat akun SUPER_ADMIN pertama di produksi (seed dev tidak dipakai di produksi).
 * Jalankan di container core:
 *   docker compose -f infra/docker-compose.prod.yml run --rm \
 *     -e ADMIN_EMAIL=admin@contoh.org -e ADMIN_NAMA="Nama" -e ADMIN_PASSWORD='...' \
 *     core node scripts/buat-super-admin.mjs
 * Gagal bila email sudah terdaftar (tidak menimpa akun yang ada).
 */
import { createRequire } from 'node:module';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../dist/generated/prisma/client.js');

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const nama = process.env.ADMIN_NAMA?.trim() || 'Super Admin';
const password = process.env.ADMIN_PASSWORD ?? '';
if (!email || password.length < 10) {
  console.error('Isi ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 10 karakter).');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  if (await prisma.user.findUnique({ where: { email } })) {
    console.error(`${email} sudah terdaftar.`);
    process.exitCode = 1;
  } else {
    await prisma.user.create({
      data: {
        email,
        nama,
        role: 'SUPER_ADMIN',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
    console.log(`SUPER_ADMIN ${email} dibuat.`);
  }
} finally {
  await prisma.$disconnect();
}
