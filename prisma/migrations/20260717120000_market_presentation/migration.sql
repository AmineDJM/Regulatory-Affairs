-- Présentations stratégiques (PPTX) générées par IA à partir d'une étude de marché,
-- avec historique de versions (relance d'analyse + commentaires). Idempotent.

CREATE TABLE IF NOT EXISTS "MarketResearchPresentation" (
  "id"          TEXT NOT NULL,
  "researchId"  TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketResearchPresentation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketResearchPresentationVersion" (
  "id"             TEXT NOT NULL,
  "presentationId" TEXT NOT NULL,
  "version"        INTEGER NOT NULL DEFAULT 1,
  "instruction"    TEXT,
  "analysis"       JSONB NOT NULL,
  "model"          TEXT,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketResearchPresentationVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketResearchPresentation_researchId_idx" ON "MarketResearchPresentation"("researchId");
CREATE INDEX IF NOT EXISTS "MarketResearchPresentationVersion_presentationId_idx" ON "MarketResearchPresentationVersion"("presentationId");

DO $$ BEGIN
  ALTER TABLE "MarketResearchPresentationVersion"
    ADD CONSTRAINT "MarketResearchPresentationVersion_presentationId_version_key" UNIQUE ("presentationId", "version");
EXCEPTION WHEN duplicate_table THEN null; WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketResearchPresentation"
    ADD CONSTRAINT "MarketResearchPresentation_researchId_fkey"
    FOREIGN KEY ("researchId") REFERENCES "MarketResearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketResearchPresentationVersion"
    ADD CONSTRAINT "MarketResearchPresentationVersion_presentationId_fkey"
    FOREIGN KEY ("presentationId") REFERENCES "MarketResearchPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
