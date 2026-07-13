-- Adventum Pulse — instantané périodique (au plus 1×/h) de l'état d'intelligence de la société
-- (agrégats Risk Radar + Process Intelligence). Persisté pour l'analyse EN CONTINU : tendances
-- (deltas / courbe) et alertes proactives (nouveau risque critique). Le champ "bucket"
-- ("YYYY-MM-DDTHH") est UNIQUE → un seul instantané par heure, même sous concurrence.
-- SQL idempotent (relançable sans erreur).

CREATE TABLE IF NOT EXISTS "IntelligenceSnapshot" (
  "id" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "riskCritical" INTEGER NOT NULL DEFAULT 0,
  "riskHigh" INTEGER NOT NULL DEFAULT 0,
  "riskMedium" INTEGER NOT NULL DEFAULT 0,
  "riskLow" INTEGER NOT NULL DEFAULT 0,
  "riskTotal" INTEGER NOT NULL DEFAULT 0,
  "inProgress" INTEGER NOT NULL DEFAULT 0,
  "stuck" INTEGER NOT NULL DEFAULT 0,
  "overdue" INTEGER NOT NULL DEFAULT 0,
  "validationsPending" INTEGER NOT NULL DEFAULT 0,
  "detail" JSONB,
  CONSTRAINT "IntelligenceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntelligenceSnapshot_bucket_key" ON "IntelligenceSnapshot"("bucket");
CREATE INDEX IF NOT EXISTS "IntelligenceSnapshot_createdAt_idx" ON "IntelligenceSnapshot"("createdAt");
