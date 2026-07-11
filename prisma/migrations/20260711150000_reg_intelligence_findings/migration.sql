-- Regulatory Intelligence OS — Phase 4 : constats (findings) + bilan de conformité. Idempotent.

DO $$ BEGIN CREATE TYPE "RegFindingSeverity" AS ENUM ('CRITICAL','MAJOR','MINOR','INFO'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegFindingStatus" AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED','WAIVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegFindingSource" AS ENUM ('RULE','AI','HUMAN'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryFinding" (
  "id" TEXT NOT NULL,
  "dossierVersionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" "RegFindingSeverity" NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "evidence" TEXT,
  "sectionCode" TEXT,
  "documentId" TEXT,
  "source" "RegFindingSource" NOT NULL DEFAULT 'RULE',
  "status" "RegFindingStatus" NOT NULL DEFAULT 'OPEN',
  "blocker" BOOLEAN NOT NULL DEFAULT false,
  "draft" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryFinding_dossierVersionId_idx" ON "RegulatoryFinding"("dossierVersionId");
CREATE INDEX IF NOT EXISTS "RegulatoryFinding_severity_idx" ON "RegulatoryFinding"("severity");
CREATE INDEX IF NOT EXISTS "RegulatoryFinding_source_idx" ON "RegulatoryFinding"("source");

CREATE TABLE IF NOT EXISTS "RegulatoryAssessment" (
  "id" TEXT NOT NULL,
  "dossierVersionId" TEXT NOT NULL,
  "completeness" INTEGER NOT NULL DEFAULT 0,
  "conforme" BOOLEAN NOT NULL DEFAULT false,
  "blockers" INTEGER NOT NULL DEFAULT 0,
  "criticals" INTEGER NOT NULL DEFAULT 0,
  "majors" INTEGER NOT NULL DEFAULT 0,
  "minors" INTEGER NOT NULL DEFAULT 0,
  "requiredPresent" INTEGER NOT NULL DEFAULT 0,
  "requiredTotal" INTEGER NOT NULL DEFAULT 0,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryAssessment_dossierVersionId_key" ON "RegulatoryAssessment"("dossierVersionId");

DO $$ BEGIN
  ALTER TABLE "RegulatoryFinding" ADD CONSTRAINT "RegulatoryFinding_dossierVersionId_fkey"
    FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryAssessment" ADD CONSTRAINT "RegulatoryAssessment_dossierVersionId_fkey"
    FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
