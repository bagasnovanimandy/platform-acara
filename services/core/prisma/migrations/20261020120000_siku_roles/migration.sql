-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sikuRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
