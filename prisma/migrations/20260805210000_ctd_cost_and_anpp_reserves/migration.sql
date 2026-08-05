-- ANALYSEUR CTD — coût de l'IA, cache de résultats, et bibliothèque transverse des réserves ANPP.
--
-- ADDITIF ET IDEMPOTENT : aucune table existante n'est modifiée de façon destructive, aucune
-- donnée n'est transformée. Les modèles `RegulatoryReserveCycle` / `RegulatoryReservePoint`
-- restent intacts — la bibliothèque s'ajoute À CÔTÉ et s'alimentera depuis eux.

-- ───────────────────────────── Budget IA par dossier ─────────────────────────────
ALTER TABLE "RegulatoryDossier" ADD COLUMN IF NOT EXISTS "aiBudgetUsd" DECIMAL(10,4);

-- ───────────────────────────── Coût, appel par appel ─────────────────────────────
CREATE TABLE IF NOT EXISTS "RegulatoryAiCall" (
  "id"               TEXT NOT NULL,
  "dossierId"        TEXT,
  "dossierVersionId" TEXT,
  "documentId"       TEXT,
  "step"             TEXT NOT NULL,
  "provider"         TEXT NOT NULL DEFAULT 'openai',
  "model"            TEXT NOT NULL,
  "batch"            BOOLEAN NOT NULL DEFAULT false,
  "inputTokens"      INTEGER NOT NULL DEFAULT 0,
  "outputTokens"     INTEGER NOT NULL DEFAULT 0,
  "cachedTokens"     INTEGER NOT NULL DEFAULT 0,
  "costUsd"          DECIMAL(10,6) NOT NULL DEFAULT 0,
  "latencyMs"        INTEGER,
  "ok"               BOOLEAN NOT NULL DEFAULT true,
  "errorCode"        TEXT,
  "cacheKey"         TEXT,
  "fromCache"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryAiCall_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryAiCall_dossierId_createdAt_idx" ON "RegulatoryAiCall"("dossierId", "createdAt");
CREATE INDEX IF NOT EXISTS "RegulatoryAiCall_dossierVersionId_idx" ON "RegulatoryAiCall"("dossierVersionId");
CREATE INDEX IF NOT EXISTS "RegulatoryAiCall_step_idx" ON "RegulatoryAiCall"("step");
CREATE INDEX IF NOT EXISTS "RegulatoryAiCall_cacheKey_idx" ON "RegulatoryAiCall"("cacheKey");
DO $$ BEGIN
  ALTER TABLE "RegulatoryAiCall" ADD CONSTRAINT "RegulatoryAiCall_dossierId_fkey"
    FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────── Cache des résultats (une V2 ne repaie pas la V1) ────────────────────
CREATE TABLE IF NOT EXISTS "RegulatoryAiCache" (
  "id"        TEXT NOT NULL,
  "cacheKey"  TEXT NOT NULL,
  "step"      TEXT NOT NULL,
  "model"     TEXT NOT NULL,
  "payload"   TEXT NOT NULL,
  "hits"      INTEGER NOT NULL DEFAULT 0,
  "lastHitAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryAiCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryAiCache_cacheKey_key" ON "RegulatoryAiCache"("cacheKey");
CREATE INDEX IF NOT EXISTS "RegulatoryAiCache_step_idx" ON "RegulatoryAiCache"("step");

-- ───────────────────────────── Réserves ANPP : énumérations ─────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AnppReserveStatus" AS ENUM ('OPEN', 'ANSWERED', 'ACCEPTED', 'REITERATED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AnppReserveSeverity" AS ENUM ('CRITICAL', 'MAJOR', 'MINOR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AnppRuleStatus" AS ENUM ('PROPOSED', 'VALIDATED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────────────────────── Lots de réserves ─────────────────────────────
CREATE TABLE IF NOT EXISTS "AnppReserveBatch" (
  "id"             TEXT NOT NULL,
  "companyId"      TEXT,
  "dossierId"      TEXT,
  "sourceCycleId"  TEXT,
  "sourceFilename" TEXT NOT NULL,
  "sourceKind"     TEXT NOT NULL DEFAULT 'PDF',
  "blobId"         TEXT,
  "sha256"         TEXT NOT NULL,
  "receivedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawText"        TEXT,
  "ocrConfidence"  DOUBLE PRECISION,
  "pageCount"      INTEGER NOT NULL DEFAULT 0,
  "extractedCount" INTEGER NOT NULL DEFAULT 0,
  "createdById"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnppReserveBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AnppReserveBatch_sha256_key" ON "AnppReserveBatch"("sha256");
CREATE INDEX IF NOT EXISTS "AnppReserveBatch_companyId_idx" ON "AnppReserveBatch"("companyId");
CREATE INDEX IF NOT EXISTS "AnppReserveBatch_dossierId_idx" ON "AnppReserveBatch"("dossierId");
CREATE INDEX IF NOT EXISTS "AnppReserveBatch_receivedAt_idx" ON "AnppReserveBatch"("receivedAt");

-- ───────────────────────────── Réserves normalisées ─────────────────────────────
CREATE TABLE IF NOT EXISTS "AnppReserve" (
  "id"                   TEXT NOT NULL,
  "batchId"              TEXT NOT NULL,
  "ordinal"              INTEGER NOT NULL DEFAULT 0,
  "productName"          TEXT,
  "dci"                  TEXT,
  "pharmaForm"           TEXT,
  "dosage"               TEXT,
  "procedureType"        TEXT,
  "supplier"             TEXT,
  "productId"            TEXT,
  "ctdModule"            TEXT,
  "ctdSection"           TEXT,
  "verbatim"             TEXT NOT NULL,
  "category"             TEXT NOT NULL DEFAULT 'AUTRE',
  "severity"             "AnppReserveSeverity" NOT NULL DEFAULT 'MAJOR',
  "targetDocument"       TEXT,
  "legalBasis"           TEXT,
  "requestedAction"      TEXT,
  "response"             TEXT,
  "responseAt"           TIMESTAMP(3),
  "correctiveDocs"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status"               "AnppReserveStatus" NOT NULL DEFAULT 'OPEN',
  "outcomeNote"          TEXT,
  "closedAt"             TIMESTAMP(3),
  "evidenceFile"         TEXT,
  "evidencePage"         INTEGER,
  "evidenceExcerpt"      TEXT,
  "extractionConfidence" DOUBLE PRECISION,
  "verifiedById"         TEXT,
  "verifiedAt"           TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnppReserve_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AnppReserve_batchId_idx" ON "AnppReserve"("batchId");
CREATE INDEX IF NOT EXISTS "AnppReserve_ctdModule_ctdSection_idx" ON "AnppReserve"("ctdModule", "ctdSection");
CREATE INDEX IF NOT EXISTS "AnppReserve_category_idx" ON "AnppReserve"("category");
CREATE INDEX IF NOT EXISTS "AnppReserve_status_idx" ON "AnppReserve"("status");
CREATE INDEX IF NOT EXISTS "AnppReserve_supplier_idx" ON "AnppReserve"("supplier");
CREATE INDEX IF NOT EXISTS "AnppReserve_dci_idx" ON "AnppReserve"("dci");
DO $$ BEGIN
  ALTER TABLE "AnppReserve" ADD CONSTRAINT "AnppReserve_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "AnppReserveBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RECHERCHE DE SIMILARITÉ : index plein texte (français) sur le verbatim, et trigram en repli
-- pour les variantes d'écriture. C'est ce qui permet de retrouver « la même réserve, dite
-- autrement » — le cœur de l'apprentissage.
CREATE INDEX IF NOT EXISTS "AnppReserve_verbatim_fts_idx"
  ON "AnppReserve" USING GIN (to_tsvector('french', "verbatim"));
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "AnppReserve_verbatim_trgm_idx"
    ON "AnppReserve" USING GIN ("verbatim" gin_trgm_ops);
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ───────────────────────────── Règles dérivées (inertes tant que non validées) ─────────────────────────────
CREATE TABLE IF NOT EXISTS "AnppDerivedRule" (
  "id"                 TEXT NOT NULL,
  "title"              TEXT NOT NULL,
  "statement"          TEXT NOT NULL,
  "ctdModule"          TEXT,
  "ctdSection"         TEXT,
  "category"           TEXT NOT NULL DEFAULT 'AUTRE',
  "severity"           "AnppReserveSeverity" NOT NULL DEFAULT 'MAJOR',
  "evidenceReserveIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "occurrences"        INTEGER NOT NULL DEFAULT 0,
  "confidence"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"             "AnppRuleStatus" NOT NULL DEFAULT 'PROPOSED',
  "reviewNote"         TEXT,
  "reviewedById"       TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnppDerivedRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AnppDerivedRule_status_idx" ON "AnppDerivedRule"("status");
CREATE INDEX IF NOT EXISTS "AnppDerivedRule_ctdModule_ctdSection_idx" ON "AnppDerivedRule"("ctdModule", "ctdSection");
