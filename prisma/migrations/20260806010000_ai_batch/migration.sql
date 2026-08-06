-- Lot d'analyse différée (Batch) : la voie à moitié prix.
-- Additive et idempotente : rejouable sans effet de bord.

CREATE TABLE IF NOT EXISTS "RegulatoryAiBatch" (
  "id"               TEXT NOT NULL,
  "companyId"        TEXT,
  "dossierId"        TEXT,
  "dossierVersionId" TEXT,
  "step"             TEXT NOT NULL,
  "provider"         TEXT NOT NULL DEFAULT 'openai',
  "model"            TEXT NOT NULL,
  "externalId"       TEXT NOT NULL,
  "inputFileId"      TEXT,
  "outputFileId"     TEXT,
  "status"           TEXT NOT NULL DEFAULT 'submitted',
  "requestCount"     INTEGER NOT NULL DEFAULT 0,
  "completedCount"   INTEGER NOT NULL DEFAULT 0,
  "failedCount"      INTEGER NOT NULL DEFAULT 0,
  "mapping"          JSONB,
  "inputTokens"      INTEGER NOT NULL DEFAULT 0,
  "outputTokens"     INTEGER NOT NULL DEFAULT 0,
  "costUsd"          DECIMAL(10,6) NOT NULL DEFAULT 0,
  "findingsCreated"  INTEGER NOT NULL DEFAULT 0,
  "error"            TEXT,
  "createdById"      TEXT,
  "submittedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"      TIMESTAMP(3),
  "processedAt"      TIMESTAMP(3),
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryAiBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryAiBatch_externalId_key" ON "RegulatoryAiBatch"("externalId");
CREATE INDEX IF NOT EXISTS "RegulatoryAiBatch_status_idx" ON "RegulatoryAiBatch"("status");
CREATE INDEX IF NOT EXISTS "RegulatoryAiBatch_dossierId_idx" ON "RegulatoryAiBatch"("dossierId");
CREATE INDEX IF NOT EXISTS "RegulatoryAiBatch_dossierVersionId_idx" ON "RegulatoryAiBatch"("dossierVersionId");
