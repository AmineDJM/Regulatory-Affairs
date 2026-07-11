-- Regulatory Intelligence OS — G1/G2 : jumeau numérique (faits sourcés) + conflits. Idempotent.

DO $$ BEGIN CREATE TYPE "RegFactStatus" AS ENUM ('PROPOSED','CONFIRMED','CORRECTED','REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegConflictStatus" AS ENUM ('OPEN','RESOLVED','WAIVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryFact" (
  "id" TEXT NOT NULL,
  "dossierVersionId" TEXT NOT NULL,
  "factKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" TEXT,
  "unit" TEXT,
  "status" "RegFactStatus" NOT NULL DEFAULT 'PROPOSED',
  "hasConflict" BOOLEAN NOT NULL DEFAULT false,
  "approvedValue" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryFact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryFact_dossierVersionId_factKey_key" ON "RegulatoryFact"("dossierVersionId","factKey");
CREATE INDEX IF NOT EXISTS "RegulatoryFact_dossierVersionId_idx" ON "RegulatoryFact"("dossierVersionId");

CREATE TABLE IF NOT EXISTS "RegulatoryFactOccurrence" (
  "id" TEXT NOT NULL,
  "factId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sectionCode" TEXT,
  "page" INTEGER,
  "rawValue" TEXT NOT NULL,
  "normalizedValue" TEXT,
  "extract" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "method" TEXT NOT NULL,
  "humanStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "effectiveDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryFactOccurrence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryFactOccurrence_factId_idx" ON "RegulatoryFactOccurrence"("factId");
CREATE INDEX IF NOT EXISTS "RegulatoryFactOccurrence_documentId_idx" ON "RegulatoryFactOccurrence"("documentId");

CREATE TABLE IF NOT EXISTS "RegulatoryConflict" (
  "id" TEXT NOT NULL,
  "dossierVersionId" TEXT NOT NULL,
  "factKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "severity" "RegFindingSeverity" NOT NULL DEFAULT 'MAJOR',
  "status" "RegConflictStatus" NOT NULL DEFAULT 'OPEN',
  "values" JSONB NOT NULL,
  "proposedAction" TEXT,
  "resolutionNote" TEXT,
  "finalValue" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryConflict_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryConflict_dossierVersionId_idx" ON "RegulatoryConflict"("dossierVersionId");

DO $$ BEGIN
  ALTER TABLE "RegulatoryFact" ADD CONSTRAINT "RegulatoryFact_dossierVersionId_fkey"
    FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryFactOccurrence" ADD CONSTRAINT "RegulatoryFactOccurrence_factId_fkey"
    FOREIGN KEY ("factId") REFERENCES "RegulatoryFact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryConflict" ADD CONSTRAINT "RegulatoryConflict_dossierVersionId_fkey"
    FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
