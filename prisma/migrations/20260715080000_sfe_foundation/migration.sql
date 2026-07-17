-- Force de vente & prévisions (SFE) : BU, produits promus, cycles mensuels, prévisions, paramètres.

DO $$ BEGIN
  CREATE TYPE "CycleStatus" AS ENUM ('OPEN','CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "BusinessUnit" (
  "id"        TEXT NOT NULL,
  "companyId" TEXT,
  "name"      TEXT NOT NULL,
  "code"      TEXT,
  "color"     TEXT,
  "headId"    TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessUnit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BusinessUnit_companyId_idx" ON "BusinessUnit"("companyId");

CREATE TABLE IF NOT EXISTS "PromoProduct" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "code"           TEXT,
  "businessUnitId" TEXT,
  "managerId"      TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoProduct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoProduct_businessUnitId_idx" ON "PromoProduct"("businessUnitId");

CREATE TABLE IF NOT EXISTS "PromoCycle" (
  "id"        TEXT NOT NULL,
  "year"      INTEGER NOT NULL,
  "month"     INTEGER NOT NULL,
  "label"     TEXT NOT NULL,
  "status"    "CycleStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCycle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoCycle_year_month_key" ON "PromoCycle"("year","month");
CREATE INDEX IF NOT EXISTS "PromoCycle_year_month_idx" ON "PromoCycle"("year","month");

CREATE TABLE IF NOT EXISTS "ProductForecast" (
  "id"                TEXT NOT NULL,
  "cycleId"           TEXT NOT NULL,
  "productId"         TEXT NOT NULL,
  "targetFte"         DECIMAL(8,2) NOT NULL DEFAULT 0,
  "coverageTargetPct" INTEGER,
  "plannedVisits"     INTEGER,
  "budget"            DECIMAL(14,2),
  "note"              TEXT,
  "updatedById"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductForecast_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductForecast_cycleId_productId_key" ON "ProductForecast"("cycleId","productId");
CREATE INDEX IF NOT EXISTS "ProductForecast_cycleId_idx" ON "ProductForecast"("cycleId");
CREATE INDEX IF NOT EXISTS "ProductForecast_productId_idx" ON "ProductForecast"("productId");

CREATE TABLE IF NOT EXISTS "SfeSettings" (
  "id"              TEXT NOT NULL,
  "positionWeights" JSONB,
  "capacity"        JSONB,
  "frequencyByTier" JSONB,
  "updatedById"     TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SfeSettings_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "BusinessUnit" ADD CONSTRAINT "BusinessUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "PromoProduct" ADD CONSTRAINT "PromoProduct_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductForecast" ADD CONSTRAINT "ProductForecast_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PromoCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "ProductForecast" ADD CONSTRAINT "ProductForecast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PromoProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
