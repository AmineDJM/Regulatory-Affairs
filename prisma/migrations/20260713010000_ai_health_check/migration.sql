-- Sonde quotidienne de santé de l'API IA (chatbot) : journalise chaque test + alerte Super Admin.
-- Idempotent.
CREATE TABLE IF NOT EXISTS "AiHealthCheck" (
  "id"         TEXT NOT NULL,
  "checkedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ok"         BOOLEAN NOT NULL,
  "model"      TEXT NOT NULL,
  "status"     INTEGER,
  "latencyMs"  INTEGER,
  "error"      TEXT,
  "notifiedAt" TIMESTAMP(3),
  CONSTRAINT "AiHealthCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiHealthCheck_checkedAt_idx" ON "AiHealthCheck" ("checkedAt");
