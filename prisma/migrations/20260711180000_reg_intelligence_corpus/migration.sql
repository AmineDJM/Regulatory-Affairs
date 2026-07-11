-- Regulatory Intelligence OS — G3/G4 : corpus versionné + index FTS/trigram (RAG). Idempotent.

DO $$ BEGIN CREATE TYPE "RegSourceStatus" AS ENUM ('DRAFT','ACTIVE','RETIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatorySource" (
  "id" TEXT NOT NULL,
  "authority" TEXT NOT NULL,
  "jurisdiction" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'fr',
  "sourceUrl" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatorySource_authority_idx" ON "RegulatorySource"("authority");
CREATE INDEX IF NOT EXISTS "RegulatorySource_jurisdiction_idx" ON "RegulatorySource"("jurisdiction");

CREATE TABLE IF NOT EXISTS "RegulatorySourceVersion" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "effectiveAt" TIMESTAMP(3),
  "status" "RegSourceStatus" NOT NULL DEFAULT 'DRAFT',
  "hash" TEXT,
  "originalText" TEXT,
  "supersedesId" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySourceVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatorySourceVersion_sourceId_idx" ON "RegulatorySourceVersion"("sourceId");
CREATE INDEX IF NOT EXISTS "RegulatorySourceVersion_status_idx" ON "RegulatorySourceVersion"("status");

CREATE TABLE IF NOT EXISTS "RegulatorySourceSection" (
  "id" TEXT NOT NULL,
  "sourceVersionId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "heading" TEXT,
  "text" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySourceSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatorySourceSection_sourceVersionId_idx" ON "RegulatorySourceSection"("sourceVersionId");

CREATE TABLE IF NOT EXISTS "RegulatoryCorpusApproval" (
  "id" TEXT NOT NULL,
  "sourceVersionId" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryCorpusApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryCorpusApproval_sourceVersionId_idx" ON "RegulatoryCorpusApproval"("sourceVersionId");

DO $$ BEGIN ALTER TABLE "RegulatorySourceVersion" ADD CONSTRAINT "RegulatorySourceVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "RegulatorySourceSection" ADD CONSTRAINT "RegulatorySourceSection_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "RegulatorySourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "RegulatoryCorpusApproval" ADD CONSTRAINT "RegulatoryCorpusApproval_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "RegulatorySourceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- RAG : recherche plein-texte (français) + trigram sur les sections.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER TABLE "RegulatorySourceSection" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('french', coalesce("heading",'') || ' ' || coalesce("text",''))) STORED;
CREATE INDEX IF NOT EXISTS "RegulatorySourceSection_search_idx" ON "RegulatorySourceSection" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "RegulatorySourceSection_trgm_idx" ON "RegulatorySourceSection" USING GIN ("text" gin_trgm_ops);
