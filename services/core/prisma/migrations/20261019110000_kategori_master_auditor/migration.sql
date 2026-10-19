-- Peran AUDITOR (lihat saja)
ALTER TYPE "Role" ADD VALUE 'AUDITOR';

-- Kategori jadi daftar yang dikelola admin; satu anggota boleh banyak kategori.
CREATE TABLE "Kategori" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "warna" TEXT NOT NULL DEFAULT 'slate',
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Kategori_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnggotaKategori" (
    "anggotaId" TEXT NOT NULL,
    "kategoriId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnggotaKategori_pkey" PRIMARY KEY ("anggotaId","kategoriId")
);

CREATE UNIQUE INDEX "Kategori_kode_key" ON "Kategori"("kode");
CREATE UNIQUE INDEX "Kategori_nama_key" ON "Kategori"("nama");
CREATE INDEX "AnggotaKategori_kategoriId_idx" ON "AnggotaKategori"("kategoriId");

ALTER TABLE "AnggotaKategori" ADD CONSTRAINT "AnggotaKategori_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnggotaKategori" ADD CONSTRAINT "AnggotaKategori_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "Kategori"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Daftar awal (bisa diubah/ditambah admin)
INSERT INTO "Kategori" ("id", "kode", "nama", "warna", "urutan", "updatedAt") VALUES
  ('kat_caberawit',    'CABERAWIT',    'Caberawit',    'amber',   10, CURRENT_TIMESTAMP),
  ('kat_praremaja',    'PRAREMAJA',    'Pra-remaja',   'sky',     20, CURRENT_TIMESTAMP),
  ('kat_remaja',       'REMAJA',       'Remaja',       'emerald', 30, CURRENT_TIMESTAMP),
  ('kat_usia_nikah',   'USIA_NIKAH',   'Usia nikah',   'violet',  40, CURRENT_TIMESTAMP),
  ('kat_usia_mandiri', 'USIA_MANDIRI', 'Usia mandiri', 'indigo',  50, CURRENT_TIMESTAMP),
  ('kat_dewasa',       'DEWASA',       'Dewasa',       'teal',    60, CURRENT_TIMESTAMP),
  ('kat_lansia',       'LANSIA',       'Lansia',       'stone',   70, CURRENT_TIMESTAMP),
  ('kat_ibu_ibu',      'IBU_IBU',      'Ibu-ibu',      'rose',    80, CURRENT_TIMESTAMP),
  ('kat_bapak_bapak',  'BAPAK_BAPAK',  'Bapak-bapak',  'cyan',    90, CURRENT_TIMESTAMP);

-- Pindahkan isi kolom lama Anggota.kategori
INSERT INTO "AnggotaKategori" ("anggotaId", "kategoriId")
SELECT "id", 'kat_' || lower("kategori"::text) FROM "Anggota" WHERE "kategori" IS NOT NULL;

DROP INDEX "Anggota_kategori_idx";
ALTER TABLE "Anggota" DROP COLUMN "kategori";
DROP TYPE "KategoriGenerus";

-- AuditLog: nama pelaku, ringkasan, dan wilayah untuk filter scope
ALTER TABLE "AuditLog" ADD COLUMN "daerahId" TEXT,
ADD COLUMN "desaId" TEXT,
ADD COLUMN "kelompokId" TEXT,
ADD COLUMN "ringkasan" TEXT NOT NULL DEFAULT '',
ADD COLUMN "userNama" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AuditLog" ALTER COLUMN "ringkasan" DROP DEFAULT, ALTER COLUMN "userNama" DROP DEFAULT;

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_kelompokId_idx" ON "AuditLog"("kelompokId");
CREATE INDEX "AuditLog_desaId_idx" ON "AuditLog"("desaId");
CREATE INDEX "AuditLog_daerahId_idx" ON "AuditLog"("daerahId");
