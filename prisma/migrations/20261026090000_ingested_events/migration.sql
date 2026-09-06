-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LES FAITS REÇUS DE L'EXTÉRIEUR (mandat 5 §37) — trace de réception des webhooks : source,
-- identifiant fournisseur (exactly-once), décision, fait du registre. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "IngestedEvent" (
  "id"              TEXT NOT NULL,
  "source"          TEXT NOT NULL,
  "externalId"      TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "status"          TEXT NOT NULL,
  "confidence"      DOUBLE PRECISION,
  "businessEventId" TEXT,
  "refs"            TEXT[] DEFAULT ARRAY[]::TEXT[],
  "candidats"       JSONB,
  "payload"         JSONB,
  "reason"          TEXT,
  "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngestedEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngestedEvent_source_externalId_key" ON "IngestedEvent"("source", "externalId");
CREATE INDEX IF NOT EXISTS "IngestedEvent_status_receivedAt_idx" ON "IngestedEvent"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "IngestedEvent_type_receivedAt_idx" ON "IngestedEvent"("type", "receivedAt");
