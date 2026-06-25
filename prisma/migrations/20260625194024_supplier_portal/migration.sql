-- CreateEnum
CREATE TYPE "ExternalRegulatoryStatus" AS ENUM ('IN_PREPARATION', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'ON_HOLD', 'CLOSED');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'SUPPLIER';

-- AlterTable
ALTER TABLE "RegulatoryProduct" ADD COLUMN     "externalActionExpected" TEXT,
ADD COLUMN     "externalComment" TEXT,
ADD COLUMN     "externalDeadline" TIMESTAMP(3),
ADD COLUMN     "externalNextStep" TEXT,
ADD COLUMN     "externalNotify" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "externalStatus" "ExternalRegulatoryStatus",
ADD COLUMN     "externalUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "portalVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierId" TEXT;

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "contactEmail" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierUser" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierUser_email_key" ON "SupplierUser"("email");

-- CreateIndex
CREATE INDEX "SupplierUser_supplierId_idx" ON "SupplierUser"("supplierId");

-- CreateIndex
CREATE INDEX "RegulatoryProduct_supplierId_idx" ON "RegulatoryProduct"("supplierId");

-- AddForeignKey
ALTER TABLE "RegulatoryProduct" ADD CONSTRAINT "RegulatoryProduct_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierUser" ADD CONSTRAINT "SupplierUser_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

