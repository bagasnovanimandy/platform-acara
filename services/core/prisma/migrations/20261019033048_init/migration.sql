-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PENGURUS');

-- CreateEnum
CREATE TYPE "JenisKelamin" AS ENUM ('L', 'P');

-- CreateEnum
CREATE TYPE "StatusAnggota" AS ENUM ('AKTIF', 'PINDAH', 'NONAKTIF');

-- CreateEnum
CREATE TYPE "HubunganWali" AS ENUM ('AYAH', 'IBU', 'WALI');

-- CreateEnum
CREATE TYPE "ScopeLevel" AS ENUM ('DAERAH', 'DESA', 'KELOMPOK');

-- CreateTable
CREATE TABLE "Daerah" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Daerah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Desa" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "daerahId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Desa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kelompok" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "desaId" TEXT NOT NULL,
    "alamat" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Kelompok_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anggota" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenisKelamin" "JenisKelamin" NOT NULL,
    "tanggalLahir" DATE,
    "noWa" TEXT,
    "kelompokId" TEXT NOT NULL,
    "status" "StatusAnggota" NOT NULL DEFAULT 'AKTIF',
    "fotoUrl" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Anggota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wali" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "noWa" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Wali_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnggotaWali" (
    "anggotaId" TEXT NOT NULL,
    "waliId" TEXT NOT NULL,
    "hubungan" "HubunganWali" NOT NULL,

    CONSTRAINT "AnggotaWali_pkey" PRIMARY KEY ("anggotaId","waliId")
);

-- CreateTable
CREATE TABLE "MutasiSambung" (
    "id" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "dariKelompokId" TEXT NOT NULL,
    "keKelompokId" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "catatan" TEXT,
    "dicatatOleh" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutasiSambung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "noWa" TEXT,
    "role" "Role" NOT NULL,
    "anggotaId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "ScopeLevel" NOT NULL,
    "refId" TEXT NOT NULL,

    CONSTRAINT "UserScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "aksi" TEXT NOT NULL,
    "entitas" TEXT NOT NULL,
    "entitasId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KodeCounter" (
    "desaId" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "KodeCounter_pkey" PRIMARY KEY ("desaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Daerah_kode_key" ON "Daerah"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Desa_kode_key" ON "Desa"("kode");

-- CreateIndex
CREATE INDEX "Desa_daerahId_idx" ON "Desa"("daerahId");

-- CreateIndex
CREATE UNIQUE INDEX "Kelompok_kode_key" ON "Kelompok"("kode");

-- CreateIndex
CREATE INDEX "Kelompok_desaId_idx" ON "Kelompok"("desaId");

-- CreateIndex
CREATE UNIQUE INDEX "Anggota_kode_key" ON "Anggota"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "Anggota_noWa_key" ON "Anggota"("noWa");

-- CreateIndex
CREATE INDEX "Anggota_kelompokId_idx" ON "Anggota"("kelompokId");

-- CreateIndex
CREATE INDEX "Anggota_nama_idx" ON "Anggota"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Wali_noWa_key" ON "Wali"("noWa");

-- CreateIndex
CREATE INDEX "AnggotaWali_waliId_idx" ON "AnggotaWali"("waliId");

-- CreateIndex
CREATE INDEX "MutasiSambung_anggotaId_idx" ON "MutasiSambung"("anggotaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_noWa_key" ON "User"("noWa");

-- CreateIndex
CREATE UNIQUE INDEX "User_anggotaId_key" ON "User"("anggotaId");

-- CreateIndex
CREATE UNIQUE INDEX "UserScope_userId_level_refId_key" ON "UserScope"("userId", "level", "refId");

-- CreateIndex
CREATE INDEX "AuditLog_entitas_entitasId_idx" ON "AuditLog"("entitas", "entitasId");

-- AddForeignKey
ALTER TABLE "Desa" ADD CONSTRAINT "Desa_daerahId_fkey" FOREIGN KEY ("daerahId") REFERENCES "Daerah"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kelompok" ADD CONSTRAINT "Kelompok_desaId_fkey" FOREIGN KEY ("desaId") REFERENCES "Desa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anggota" ADD CONSTRAINT "Anggota_kelompokId_fkey" FOREIGN KEY ("kelompokId") REFERENCES "Kelompok"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnggotaWali" ADD CONSTRAINT "AnggotaWali_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnggotaWali" ADD CONSTRAINT "AnggotaWali_waliId_fkey" FOREIGN KEY ("waliId") REFERENCES "Wali"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutasiSambung" ADD CONSTRAINT "MutasiSambung_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "Anggota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScope" ADD CONSTRAINT "UserScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
