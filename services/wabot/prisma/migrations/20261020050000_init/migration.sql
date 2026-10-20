-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "KategoriIzin" AS ENUM ('IZIN', 'SAKIT');

-- CreateEnum
CREATE TYPE "StatusIzin" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PengajuTipe" AS ENUM ('ANGGOTA', 'WALI');

-- CreateEnum
CREATE TYPE "ArahPesan" AS ENUM ('MASUK', 'KELUAR');

-- CreateTable
CREATE TABLE "AnggotaRef" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "kelompokId" TEXT NOT NULL,
    "desaId" TEXT NOT NULL,
    "daerahId" TEXT NOT NULL,
    "namaKelompok" TEXT NOT NULL,
    "namaDesa" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "noWa" TEXT,
    "waliNoWa" TEXT[],
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "syncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnggotaRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Izin" (
    "id" TEXT NOT NULL,
    "nomor" SERIAL NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "kodeAnggota" TEXT NOT NULL,
    "namaAnggota" TEXT NOT NULL,
    "kelompokId" TEXT NOT NULL,
    "namaKelompok" TEXT NOT NULL,
    "namaDesa" TEXT NOT NULL,
    "pengajuNoWa" TEXT NOT NULL,
    "pengajuTipe" "PengajuTipe" NOT NULL,
    "acaraId" TEXT NOT NULL,
    "acaraNama" TEXT NOT NULL,
    "sesiId" TEXT NOT NULL,
    "sesiNama" TEXT NOT NULL,
    "sesiMulai" TIMESTAMPTZ(3) NOT NULL,
    "kategori" "KategoriIzin" NOT NULL,
    "alasan" VARCHAR(300) NOT NULL,
    "status" "StatusIzin" NOT NULL DEFAULT 'SUBMITTED',
    "handlerUserIds" TEXT[],
    "decidedBy" TEXT,
    "decidedByNama" TEXT,
    "decidedVia" TEXT,
    "decidedAt" TIMESTAMPTZ(3),
    "catatanPengurus" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Izin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesanLog" (
    "id" TEXT NOT NULL,
    "noWa" TEXT NOT NULL,
    "arah" "ArahPesan" NOT NULL,
    "isi" TEXT NOT NULL,
    "izinId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PesanLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnggotaRef_kode_key" ON "AnggotaRef"("kode");

-- CreateIndex
CREATE INDEX "AnggotaRef_noWa_idx" ON "AnggotaRef"("noWa");

-- CreateIndex
CREATE INDEX "AnggotaRef_waliNoWa_idx" ON "AnggotaRef" USING GIN ("waliNoWa");

-- CreateIndex
CREATE UNIQUE INDEX "Izin_nomor_key" ON "Izin"("nomor");

-- CreateIndex
CREATE INDEX "Izin_anggotaId_sesiId_idx" ON "Izin"("anggotaId", "sesiId");

-- CreateIndex
CREATE INDEX "Izin_status_idx" ON "Izin"("status");

-- CreateIndex
CREATE INDEX "Izin_kelompokId_idx" ON "Izin"("kelompokId");

-- CreateIndex
CREATE INDEX "Izin_pengajuNoWa_idx" ON "Izin"("pengajuNoWa");

-- CreateIndex
CREATE INDEX "PesanLog_noWa_createdAt_idx" ON "PesanLog"("noWa", "createdAt");

-- CreateIndex
CREATE INDEX "PesanLog_createdAt_idx" ON "PesanLog"("createdAt");

