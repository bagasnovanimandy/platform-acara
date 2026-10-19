-- AlterTable
ALTER TABLE "OperatorSession" ADD COLUMN     "baterai" INTEGER,
ADD COLUMN     "kode" TEXT,
ADD COLUMN     "pinGagal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qrIssuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sedangInput" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terkunciSampai" TIMESTAMPTZ(3);

-- Perangkat uji dari fase 3 belum punya kode pintu.
UPDATE "OperatorSession" SET "kode" = upper(substr(md5("id"), 1, 6)) WHERE "kode" IS NULL;
ALTER TABLE "OperatorSession" ALTER COLUMN "kode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OperatorSession_kode_key" ON "OperatorSession"("kode");
