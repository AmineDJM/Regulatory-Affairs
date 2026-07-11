-- Regulatory Intelligence OS — G5 : moteur de règles administrable (rule packs + règles). Idempotent.

DO $$ BEGIN CREATE TYPE "RegRuleKind" AS ENUM ('SECTION_REQUIRED','SECTION_EXPECTED','DOCUMENT_PRESENT','FACT_REQUIRED','CUSTOM'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryRulePack" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "jurisdiction" TEXT NOT NULL DEFAULT 'DZ',
  "version" TEXT NOT NULL DEFAULT '1.0',
  "status" "RegSourceStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRulePack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryRulePack_code_key" ON "RegulatoryRulePack"("code");
CREATE INDEX IF NOT EXISTS "RegulatoryRulePack_status_idx" ON "RegulatoryRulePack"("status");
CREATE INDEX IF NOT EXISTS "RegulatoryRulePack_jurisdiction_idx" ON "RegulatoryRulePack"("jurisdiction");

CREATE TABLE IF NOT EXISTS "RegulatoryRule" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "RegRuleKind" NOT NULL DEFAULT 'SECTION_REQUIRED',
  "sectionCode" TEXT,
  "factKey" TEXT,
  "severity" "RegFindingSeverity" NOT NULL DEFAULT 'CRITICAL',
  "blocker" BOOLEAN NOT NULL DEFAULT true,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "remediation" TEXT,
  "procedureTypes" TEXT[],
  "productTypes" TEXT[],
  "sourceVersionId" TEXT,
  "sourcePath" TEXT,
  "effectiveAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "params" JSONB,
  "tests" JSONB,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryRule_packId_code_key" ON "RegulatoryRule"("packId","code");
CREATE INDEX IF NOT EXISTS "RegulatoryRule_packId_idx" ON "RegulatoryRule"("packId");
CREATE INDEX IF NOT EXISTS "RegulatoryRule_kind_idx" ON "RegulatoryRule"("kind");

DO $$ BEGIN ALTER TABLE "RegulatoryRule" ADD CONSTRAINT "RegulatoryRule_packId_fkey" FOREIGN KEY ("packId") REFERENCES "RegulatoryRulePack"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
