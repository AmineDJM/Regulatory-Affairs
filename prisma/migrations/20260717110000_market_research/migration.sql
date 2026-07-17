-- Business Development : études de marché (Market Research) — étude, lignes produit, acteurs.

DO $$ BEGIN
  CREATE TYPE "MarketResearchStatus" AS ENUM ('DRAFT','FINAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PlayerStatus" AS ENUM ('IMPORT','MANUFACTURING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "MarketResearch" (
  "id"          TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "status"      "MarketResearchStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"       TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketResearch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketResearch_createdById_idx" ON "MarketResearch"("createdById");

CREATE TABLE IF NOT EXISTS "MarketResearchRow" (
  "id"                TEXT NOT NULL,
  "researchId"        TEXT NOT NULL,
  "therapeuticClass"  TEXT,
  "product"           TEXT NOT NULL,
  "marketVolume"      DECIMAL(18,2),
  "marketValueUsd"    DECIMAL(18,2),
  "avgPricePerBoxUsd" DECIMAL(14,2),
  "comment"           TEXT,
  "sortOrder"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketResearchRow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketResearchRow_researchId_idx" ON "MarketResearchRow"("researchId");

CREATE TABLE IF NOT EXISTS "MarketResearchPlayer" (
  "id"               TEXT NOT NULL,
  "rowId"            TEXT NOT NULL,
  "rank"             INTEGER NOT NULL DEFAULT 1,
  "name"             TEXT NOT NULL,
  "marketShareValue" DECIMAL(18,2),
  "status"           "PlayerStatus",
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketResearchPlayer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketResearchPlayer_rowId_idx" ON "MarketResearchPlayer"("rowId");

DO $$ BEGIN
  ALTER TABLE "MarketResearchRow" ADD CONSTRAINT "MarketResearchRow_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "MarketResearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketResearchPlayer" ADD CONSTRAINT "MarketResearchPlayer_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "MarketResearchRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
