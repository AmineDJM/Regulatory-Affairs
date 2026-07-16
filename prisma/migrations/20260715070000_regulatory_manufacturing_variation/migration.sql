-- Statut de fabrication + cycle de vie des variations (Regulatory).

-- Enums (idempotents).
DO $$ BEGIN
  CREATE TYPE "ManufacturingStatus" AS ENUM ('IMPORTATION','SECONDARY_PACKAGING','PRIMARY_PACKAGING','FULL_PROCESS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "VariationStatus" AS ENUM ('EN_ATTENTE','OBTENUE','ANNULE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Statut de fabrication courant du produit (démarre en Importation).
ALTER TABLE "RegulatoryProduct"
  ADD COLUMN IF NOT EXISTS "manufacturingStatus" "ManufacturingStatus" NOT NULL DEFAULT 'IMPORTATION';

-- Table des variations de fabrication.
CREATE TABLE IF NOT EXISTS "RegulatoryVariation" (
  "id"           TEXT NOT NULL,
  "productId"    TEXT NOT NULL,
  "toStatus"     "ManufacturingStatus" NOT NULL,
  "status"       "VariationStatus" NOT NULL DEFAULT 'EN_ATTENTE',
  "depotDate"    TIMESTAMP(3),
  "decisionDate" TIMESTAMP(3),
  "manufacturer" TEXT,
  "note"         TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryVariation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegulatoryVariation_productId_idx" ON "RegulatoryVariation"("productId");

DO $$ BEGIN
  ALTER TABLE "RegulatoryVariation"
    ADD CONSTRAINT "RegulatoryVariation_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "RegulatoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
