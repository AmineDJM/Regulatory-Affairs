-- MODULE « ENTRAÎNEMENT IA » : études de cas (produits passés + issue ANPP + leçon) et leurs
-- documents. Matière de précédents injectés dans l'analyse — jamais des règles opposables.
-- Idempotent — sûr à rejouer.

DO $$ BEGIN
  CREATE TYPE "RegCaseOutcome" AS ENUM ('ACCEPTED', 'ACCEPTED_WITH_RESERVES', 'REJECTED', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryCaseStudy" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "productName" TEXT,
  "outcome"     "RegCaseOutcome" NOT NULL DEFAULT 'UNKNOWN',
  "lesson"      TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryCaseStudy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RegulatoryCaseDoc" (
  "id"         TEXT NOT NULL,
  "caseId"     TEXT NOT NULL,
  "filename"   TEXT NOT NULL,
  "ctdSection" TEXT,
  "sections"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "text"       TEXT NOT NULL,
  "sha256"     TEXT NOT NULL,
  "embedding"  JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryCaseDoc_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "RegulatoryCaseDoc" ADD CONSTRAINT "RegulatoryCaseDoc_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "RegulatoryCaseStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "RegulatoryCaseDoc_caseId_idx" ON "RegulatoryCaseDoc"("caseId");
CREATE INDEX IF NOT EXISTS "RegulatoryCaseDoc_ctdSection_idx" ON "RegulatoryCaseDoc"("ctdSection");
