-- CreateEnum
CREATE TYPE "RegulatoryCategory" AS ENUM ('MEDICINE', 'MEDICAL_DEVICE');

-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('PRODUCT', 'SERVICE');

-- AlterTable
ALTER TABLE "RegulatoryProduct" ADD COLUMN     "category" "RegulatoryCategory" NOT NULL DEFAULT 'MEDICINE';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "saleType" "SaleType" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "serviceDescription" TEXT;

