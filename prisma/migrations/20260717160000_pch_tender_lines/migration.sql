-- Refonte PCH — Marché public : lignes de produits d'un appel d'offres (analyse IA + enrichissement
-- intelligence marché), conditionnement en boîtes, suivi commercial ; dates d'arrivée logistique sur
-- les bons de commande. Idempotent.

DO $$ BEGIN
  CREATE TYPE "PchLineStatus" AS ENUM ('PENDING', 'QUOTED', 'SUBMITTED', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "PchTenderLine" (
  "id"                     TEXT NOT NULL,
  "tenderId"               TEXT NOT NULL,
  "sortOrder"              INTEGER NOT NULL DEFAULT 0,
  "designation"            TEXT NOT NULL,
  "dci"                    TEXT,
  "dosage"                 TEXT,
  "form"                   TEXT,
  "quantityUnits"          INTEGER NOT NULL DEFAULT 0,
  "unitsPerBox"            INTEGER,
  "haveProduct"            BOOLEAN NOT NULL DEFAULT false,
  "ourProductId"           TEXT,
  "ourProduct"             TEXT,
  "unitPriceDzd"           DECIMAL(14,2),
  "suppliersInfo"          TEXT,
  "competitorCount"        INTEGER,
  "registeredNomenclature" BOOLEAN NOT NULL DEFAULT false,
  "nomLines"               INTEGER,
  "marketEstimateDzd"      DECIMAL(18,2),
  "status"                 "PchLineStatus" NOT NULL DEFAULT 'PENDING',
  "awardedUnitPriceDzd"    DECIMAL(14,2),
  "note"                   TEXT,
  "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchTenderLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PchTenderLine_tenderId_idx" ON "PchTenderLine"("tenderId");

DO $$ BEGIN
  ALTER TABLE "PchTenderLine" ADD CONSTRAINT "PchTenderLine_tenderId_fkey"
    FOREIGN KEY ("tenderId") REFERENCES "PchTender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "PchOrder" ADD COLUMN IF NOT EXISTS "expectedArrival" TIMESTAMP(3);
ALTER TABLE "PchOrder" ADD COLUMN IF NOT EXISTS "arrivedDate"     TIMESTAMP(3);
