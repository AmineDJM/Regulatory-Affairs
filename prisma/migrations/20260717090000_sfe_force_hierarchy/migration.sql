-- Force de vente Phase 2/3 : équipes (superviseur national), profils KAM, matrice d'affectation.

CREATE TABLE IF NOT EXISTS "SalesTeam" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "code"           TEXT,
  "supervisorId"   TEXT,
  "businessUnitId" TEXT,
  "color"          TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesTeam_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesTeam_supervisorId_idx" ON "SalesTeam"("supervisorId");
CREATE INDEX IF NOT EXISTS "SalesTeam_businessUnitId_idx" ON "SalesTeam"("businessUnitId");

CREATE TABLE IF NOT EXISTS "SalesRepProfile" (
  "id"              TEXT NOT NULL,
  "repId"           TEXT NOT NULL,
  "teamId"          TEXT,
  "region"          TEXT,
  "capDaysPerMonth" INTEGER,
  "capVisitsPerDay" INTEGER,
  "capFieldPct"     INTEGER,
  "fteBudget"       DECIMAL(6,2) NOT NULL DEFAULT 1,
  "seniority"       TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "note"            TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesRepProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesRepProfile_repId_key" ON "SalesRepProfile"("repId");
CREATE INDEX IF NOT EXISTS "SalesRepProfile_teamId_idx" ON "SalesRepProfile"("teamId");

CREATE TABLE IF NOT EXISTS "PromotionAssignment" (
  "id"            TEXT NOT NULL,
  "cycleId"       TEXT NOT NULL,
  "repId"         TEXT NOT NULL,
  "productId"     TEXT NOT NULL,
  "position"      INTEGER NOT NULL DEFAULT 1,
  "plannedVisits" INTEGER NOT NULL DEFAULT 0,
  "note"          TEXT,
  "updatedById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionAssignment_cycleId_repId_productId_key" ON "PromotionAssignment"("cycleId","repId","productId");
CREATE INDEX IF NOT EXISTS "PromotionAssignment_cycleId_idx" ON "PromotionAssignment"("cycleId");
CREATE INDEX IF NOT EXISTS "PromotionAssignment_repId_idx" ON "PromotionAssignment"("repId");
CREATE INDEX IF NOT EXISTS "PromotionAssignment_productId_idx" ON "PromotionAssignment"("productId");

DO $$ BEGIN
  ALTER TABLE "SalesTeam" ADD CONSTRAINT "SalesTeam_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesRepProfile" ADD CONSTRAINT "SalesRepProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SalesTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "PromotionAssignment" ADD CONSTRAINT "PromotionAssignment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PromoCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "PromotionAssignment" ADD CONSTRAINT "PromotionAssignment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PromoProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
