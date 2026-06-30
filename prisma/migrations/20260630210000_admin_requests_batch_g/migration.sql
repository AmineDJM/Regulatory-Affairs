-- Demandes administratives : multi-cellules, suppression traçable, flux de traitement
ALTER TABLE "AdministrativeRequest" ADD COLUMN "processingStartedAt" TIMESTAMP(3);
ALTER TABLE "AdministrativeRequest" ADD COLUMN "batchId" TEXT;
ALTER TABLE "AdministrativeRequest" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "AdministrativeRequest" ADD COLUMN "deletedById" TEXT;
ALTER TABLE "AdministrativeRequest" ADD COLUMN "deletionReason" TEXT;
CREATE INDEX "AdministrativeRequest_batchId_idx" ON "AdministrativeRequest"("batchId");
CREATE INDEX "AdministrativeRequest_deletedAt_idx" ON "AdministrativeRequest"("deletedAt");

-- Catalogue d'articles de fourniture de bureau
CREATE TABLE "OfficeSupplyArticle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT,
    "reference" TEXT,
    "estimatedPrice" DECIMAL(12,2),
    "supplierHint" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfficeSupplyArticle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OfficeSupplyArticle_active_idx" ON "OfficeSupplyArticle"("active");
CREATE INDEX "OfficeSupplyArticle_category_idx" ON "OfficeSupplyArticle"("category");

-- Nouveau type d'entité pour la traçabilité (audit)
ALTER TYPE "EntityType" ADD VALUE 'OFFICE_SUPPLY_ARTICLE';
