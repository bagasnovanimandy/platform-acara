-- CreateEnum
CREATE TYPE "StatusAcara" AS ENUM ('DRAFT', 'TERJADWAL', 'BERLANGSUNG', 'SELESAI', 'BATAL');

-- CreateEnum
CREATE TYPE "StatusSesi" AS ENUM ('TERJADWAL', 'DIBUKA', 'DITUTUP');

-- CreateEnum
CREATE TYPE "TingkatAcara" AS ENUM ('KELOMPOK', 'DESA', 'DAERAH', 'GABUNGAN');

-- CreateEnum
CREATE TYPE "PeranPJ" AS ENUM ('PJ_UMUM', 'PJ_IZIN', 'PJ_ABSENSI', 'PJ_DOKUMENTASI', 'LAINNYA');

-- CreateEnum
CREATE TYPE "MetodeAbsensi" AS ENUM ('WAJAH', 'MANUAL', 'TAMU');

-- CreateEnum
CREATE TYPE "StatusWajah" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StatusRekap" AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'ALPHA');

-- CreateEnum
CREATE TYPE "KategoriIzin" AS ENUM ('IZIN', 'SAKIT');

-- CreateTable
CREATE TABLE "AnggotaRef" (
    "id" TEXT NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenisKelamin" TEXT NOT NULL,
    "tanggalLahir" DATE,
    "kelompokId" TEXT NOT NULL,
    "desaId" TEXT NOT NULL,
    "daerahId" TEXT NOT NULL,
    "namaKelompok" TEXT NOT NULL,
    "namaDesa" TEXT NOT NULL,
    "namaDaerah" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "kategori" TEXT[],
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "syncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnggotaRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acara" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "deskripsi" TEXT,
    "lokasi" TEXT,
    "tingkat" "TingkatAcara" NOT NULL,
    "penyelenggaraLevel" TEXT NOT NULL,
    "penyelenggaraId" TEXT NOT NULL,
    "tanggalMulai" TIMESTAMPTZ(3) NOT NULL,
    "tanggalSelesai" TIMESTAMPTZ(3) NOT NULL,
    "status" "StatusAcara" NOT NULL DEFAULT 'DRAFT',
    "deletedAt" TIMESTAMPTZ(3),
    "thresholdWajah" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "dibuatOleh" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Acara_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesi" (
    "id" TEXT NOT NULL,
    "acaraId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "mulai" TIMESTAMPTZ(3) NOT NULL,
    "selesai" TIMESTAMPTZ(3) NOT NULL,
    "toleransiMenit" INTEGER NOT NULL DEFAULT 15,
    "batasIzin" TIMESTAMPTZ(3),
    "status" "StatusSesi" NOT NULL DEFAULT 'TERJADWAL',
    "ditutupAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Sesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RundownItem" (
    "id" TEXT NOT NULL,
    "sesiId" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL,
    "mulai" TIMESTAMPTZ(3),
    "selesai" TIMESTAMPTZ(3),
    "judul" TEXT NOT NULL,
    "keterangan" TEXT,

    CONSTRAINT "RundownItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pengisi" (
    "id" TEXT NOT NULL,
    "rundownItemId" TEXT NOT NULL,
    "anggotaId" TEXT,
    "namaBebas" TEXT,
    "peran" TEXT,

    CONSTRAINT "Pengisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaraPJ" (
    "id" TEXT NOT NULL,
    "acaraId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "peran" "PeranPJ" NOT NULL,
    "keterangan" TEXT,

    CONSTRAINT "AcaraPJ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesertaRule" (
    "id" TEXT NOT NULL,
    "acaraId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "jenisKelamin" TEXT,
    "kategori" TEXT[],

    CONSTRAINT "PesertaRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesertaSesi" (
    "sesiId" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "kelompokId" TEXT NOT NULL,
    "desaId" TEXT NOT NULL,
    "daerahId" TEXT NOT NULL,

    CONSTRAINT "PesertaSesi_pkey" PRIMARY KEY ("sesiId","anggotaId")
);

-- CreateTable
CREATE TABLE "FotoKegiatan" (
    "id" TEXT NOT NULL,
    "acaraId" TEXT NOT NULL,
    "sesiId" TEXT,
    "path" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "caption" TEXT,
    "diunggahOleh" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoKegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorSession" (
    "id" TEXT NOT NULL,
    "sesiId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "nomor" INTEGER NOT NULL,
    "pinHash" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "qrUsedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "lastScanAt" TIMESTAMPTZ(3),
    "antrean" INTEGER NOT NULL DEFAULT 0,
    "perangkat" TEXT,
    "dibuatOleh" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absensi" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sesiId" TEXT NOT NULL,
    "anggotaId" TEXT,
    "tamuId" TEXT,
    "metode" "MetodeAbsensi" NOT NULL,
    "operatorSessionId" TEXT,
    "dicatatAdminId" TEXT,
    "faceDataId" TEXT,
    "faceDistance" DOUBLE PRECISION,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "syncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terlambat" BOOLEAN NOT NULL DEFAULT false,
    "perluTinjau" BOOLEAN NOT NULL DEFAULT false,
    "catatan" TEXT,

    CONSTRAINT "Absensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsensiDuplikat" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sesiId" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "operatorSessionId" TEXT,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbsensiDuplikat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tamu" (
    "id" TEXT NOT NULL,
    "sesiId" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "keterangan" TEXT,
    "dicocokkanKeAnggotaId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tamu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceData" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "embeddings" JSONB NOT NULL,
    "thumbnails" TEXT[],
    "status" "StatusWajah" NOT NULL DEFAULT 'PENDING',
    "sumber" TEXT NOT NULL,
    "enrolledByOperatorSessionId" TEXT,
    "enrolledByUserId" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "alasanTolak" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IzinRef" (
    "id" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "acaraId" TEXT NOT NULL,
    "sesiId" TEXT,
    "kategori" "KategoriIzin" NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IzinRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rekap" (
    "sesiId" TEXT NOT NULL,
    "anggotaId" TEXT NOT NULL,
    "status" "StatusRekap" NOT NULL,
    "terlambat" BOOLEAN NOT NULL DEFAULT false,
    "absensiId" TEXT,
    "izinId" TEXT,
    "dihitungAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rekap_pkey" PRIMARY KEY ("sesiId","anggotaId")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnggotaRef_kode_key" ON "AnggotaRef"("kode");

-- CreateIndex
CREATE INDEX "AnggotaRef_kelompokId_idx" ON "AnggotaRef"("kelompokId");

-- CreateIndex
CREATE INDEX "AnggotaRef_desaId_idx" ON "AnggotaRef"("desaId");

-- CreateIndex
CREATE INDEX "AnggotaRef_daerahId_idx" ON "AnggotaRef"("daerahId");

-- CreateIndex
CREATE INDEX "AnggotaRef_kategori_idx" ON "AnggotaRef" USING GIN ("kategori");

-- CreateIndex
CREATE INDEX "Acara_penyelenggaraLevel_penyelenggaraId_idx" ON "Acara"("penyelenggaraLevel", "penyelenggaraId");

-- CreateIndex
CREATE INDEX "Acara_tanggalMulai_idx" ON "Acara"("tanggalMulai");

-- CreateIndex
CREATE INDEX "Sesi_acaraId_idx" ON "Sesi"("acaraId");

-- CreateIndex
CREATE INDEX "RundownItem_sesiId_urutan_idx" ON "RundownItem"("sesiId", "urutan");

-- CreateIndex
CREATE UNIQUE INDEX "AcaraPJ_acaraId_userId_peran_key" ON "AcaraPJ"("acaraId", "userId", "peran");

-- CreateIndex
CREATE INDEX "PesertaRule_acaraId_idx" ON "PesertaRule"("acaraId");

-- CreateIndex
CREATE INDEX "FotoKegiatan_acaraId_idx" ON "FotoKegiatan"("acaraId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorSession_qrToken_key" ON "OperatorSession"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorSession_sesiId_nomor_key" ON "OperatorSession"("sesiId", "nomor");

-- CreateIndex
CREATE UNIQUE INDEX "Absensi_clientId_key" ON "Absensi"("clientId");

-- CreateIndex
CREATE INDEX "Absensi_operatorSessionId_idx" ON "Absensi"("operatorSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Absensi_sesiId_anggotaId_key" ON "Absensi"("sesiId", "anggotaId");

-- CreateIndex
CREATE UNIQUE INDEX "AbsensiDuplikat_clientId_key" ON "AbsensiDuplikat"("clientId");

-- CreateIndex
CREATE INDEX "AbsensiDuplikat_sesiId_idx" ON "AbsensiDuplikat"("sesiId");

-- CreateIndex
CREATE UNIQUE INDEX "FaceData_clientId_key" ON "FaceData"("clientId");

-- CreateIndex
CREATE INDEX "FaceData_anggotaId_idx" ON "FaceData"("anggotaId");

-- CreateIndex
CREATE INDEX "FaceData_status_idx" ON "FaceData"("status");

-- CreateIndex
CREATE INDEX "IzinRef_anggotaId_acaraId_idx" ON "IzinRef"("anggotaId", "acaraId");

-- CreateIndex
CREATE INDEX "Rekap_sesiId_status_idx" ON "Rekap"("sesiId", "status");

-- AddForeignKey
ALTER TABLE "Sesi" ADD CONSTRAINT "Sesi_acaraId_fkey" FOREIGN KEY ("acaraId") REFERENCES "Acara"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RundownItem" ADD CONSTRAINT "RundownItem_sesiId_fkey" FOREIGN KEY ("sesiId") REFERENCES "Sesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pengisi" ADD CONSTRAINT "Pengisi_rundownItemId_fkey" FOREIGN KEY ("rundownItemId") REFERENCES "RundownItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaraPJ" ADD CONSTRAINT "AcaraPJ_acaraId_fkey" FOREIGN KEY ("acaraId") REFERENCES "Acara"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesertaRule" ADD CONSTRAINT "PesertaRule_acaraId_fkey" FOREIGN KEY ("acaraId") REFERENCES "Acara"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesertaSesi" ADD CONSTRAINT "PesertaSesi_sesiId_fkey" FOREIGN KEY ("sesiId") REFERENCES "Sesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoKegiatan" ADD CONSTRAINT "FotoKegiatan_acaraId_fkey" FOREIGN KEY ("acaraId") REFERENCES "Acara"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorSession" ADD CONSTRAINT "OperatorSession_sesiId_fkey" FOREIGN KEY ("sesiId") REFERENCES "Sesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absensi" ADD CONSTRAINT "Absensi_sesiId_fkey" FOREIGN KEY ("sesiId") REFERENCES "Sesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absensi" ADD CONSTRAINT "Absensi_operatorSessionId_fkey" FOREIGN KEY ("operatorSessionId") REFERENCES "OperatorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceData" ADD CONSTRAINT "FaceData_anggotaId_fkey" FOREIGN KEY ("anggotaId") REFERENCES "AnggotaRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceData" ADD CONSTRAINT "FaceData_enrolledByOperatorSessionId_fkey" FOREIGN KEY ("enrolledByOperatorSessionId") REFERENCES "OperatorSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rekap" ADD CONSTRAINT "Rekap_sesiId_fkey" FOREIGN KEY ("sesiId") REFERENCES "Sesi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
