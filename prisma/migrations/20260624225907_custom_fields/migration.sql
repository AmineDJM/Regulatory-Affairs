-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');

-- AlterTable
ALTER TABLE "BudgetLine" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "BusinessDevelopmentOpportunity" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "CongressInternational" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "CongressNational" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "LogisticsOrder" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "MedicalDoctor" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "MedicalVisit" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "RegulatoryProduct" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "custom" JSONB;

-- AlterTable
ALTER TABLE "SponsoringRequest" ADD COLUMN     "custom" JSONB;

-- CreateTable
CREATE TABLE "CustomFieldDef" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "options" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomFieldDef_entityType_idx" ON "CustomFieldDef"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_entityType_key_key" ON "CustomFieldDef"("entityType", "key");
