-- CreateEnum
CREATE TYPE "KategoriGenerus" AS ENUM ('CABERAWIT', 'PRAREMAJA', 'REMAJA', 'USIA_NIKAH');

-- AlterTable
ALTER TABLE "Anggota" ADD COLUMN     "kategori" "KategoriGenerus";

-- CreateIndex
CREATE INDEX "Anggota_kategori_idx" ON "Anggota"("kategori");
