-- RETOURS & RECLAMATIONS (Operations & Sales, Direction 08/10) : un retour de marchandise, une reclamation qualite ou un
-- rappel de lot, declare depuis le terrain ou par les operations, instruit par son responsable (OUVERTE -> EN_ANALYSE ->
-- CLOTUREE avec sa conclusion). Le fil d'echange et les pieces sont polymorphes (Comment / Document, entityType
-- RECLAMATION).
--
-- STOCK PCH CENTRAL saisi a la main (recu par mail) : les quantites sont des StockSnapshot (scope PCH / ANNEX) deja
-- existants ; le mail ou le PDF de la PCH se joint a un releve identifie par sa date (entityType STOCK_PCH_RELEVE).
--
-- Additif et idempotent. Les valeurs d'enumeration neuves ne sont PAS utilisees dans cette migration (elles ne peuvent
-- pas servir dans la transaction qui les ajoute).
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'RECLAMATION';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'STOCK_PCH_RELEVE';

CREATE TABLE IF NOT EXISTS "Reclamation" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OUVERTE',
  "promoProductId" TEXT,
  "productId" TEXT,
  "productLabel" TEXT NOT NULL,
  "businessUnitId" TEXT,
  "lot" TEXT,
  "quantity" INTEGER,
  "institutionId" TEXT,
  "institutionName" TEXT,
  "pchSite" TEXT,
  "occurredOn" TIMESTAMP(3),
  "description" TEXT NOT NULL,
  "conclusion" TEXT,
  "pvCaseId" TEXT,
  "declaredById" TEXT NOT NULL,
  "ownerId" TEXT,
  "analysedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reclamation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Reclamation_reference_key" ON "Reclamation"("reference");
CREATE INDEX IF NOT EXISTS "Reclamation_status_idx" ON "Reclamation"("status");
CREATE INDEX IF NOT EXISTS "Reclamation_type_idx" ON "Reclamation"("type");
CREATE INDEX IF NOT EXISTS "Reclamation_businessUnitId_idx" ON "Reclamation"("businessUnitId");
CREATE INDEX IF NOT EXISTS "Reclamation_declaredById_idx" ON "Reclamation"("declaredById");
CREATE INDEX IF NOT EXISTS "Reclamation_ownerId_idx" ON "Reclamation"("ownerId");
CREATE INDEX IF NOT EXISTS "Reclamation_createdAt_idx" ON "Reclamation"("createdAt");
