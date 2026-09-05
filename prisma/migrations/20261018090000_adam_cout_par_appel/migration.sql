-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ADAM — LE COÛT DEVIENT UNE MÉTRIQUE DE PREMIER RANG.
--
-- ── CE QUI MANQUAIT ──────────────────────────────────────────────────────────────────────
--
-- `AiUsageLog` comptait des appels, des tours et des latences — jamais un jeton ni un dollar.
-- La passerelle mesurait pourtant tout (jetons, cache, réflexion, coût exact ou inconnu) et le
-- jetait dans le journal serveur. On ne pouvait répondre ni « combien coûte une conversation »,
-- ni « quel modèle mange le budget », ni « combien a coûté cette mission ».
--
-- ── CE QUE CETTE MIGRATION AJOUTE ────────────────────────────────────────────────────────
--
--   • sur `AiUsageLog` : les agrégats du TOUR (appels, jetons, cache, réflexion, recherches web,
--     coût) et de quoi le relier (tour, route, niveau, fil) ;
--   • `ModelCallLog` : UNE ligne PAR APPEL de modèle, écrite par la passerelle via un puits
--     tamponné — rôle, modèle, jetons, cache, coût, mission/fil/personne ;
--   • `MissionWorkerRun.costUsd` devient NULLABLE : un coût inconnu n'est pas un coût nul.
--
-- Idempotent : rejouable sans effet.

ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "turnId"            TEXT;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "route"             TEXT;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "complexity"        TEXT;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "threadId"          TEXT;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "llmCalls"          INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "inputTokens"       INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "outputTokens"      INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "cachedInputTokens" INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "reasoningTokens"   INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "webSearchCalls"    INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "costUsd"           DECIMAL(12,6);
CREATE INDEX IF NOT EXISTS "AiUsageLog_threadId_idx" ON "AiUsageLog" ("threadId");

CREATE TABLE IF NOT EXISTS "ModelCallLog" (
  "id"                TEXT NOT NULL,
  "at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "turnId"            TEXT,
  "route"             TEXT,
  "feature"           TEXT,
  "userId"            TEXT,
  "threadId"          TEXT,
  "missionId"         TEXT,
  "role"              TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "model"             TEXT NOT NULL,
  "inputTokens"       INTEGER NOT NULL,
  "outputTokens"      INTEGER NOT NULL,
  "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
  "reasoningTokens"   INTEGER NOT NULL DEFAULT 0,
  "webSearchCalls"    INTEGER NOT NULL DEFAULT 0,
  "costUsd"           DECIMAL(12,6),
  "ms"                INTEGER NOT NULL DEFAULT 0,
  "attempts"          INTEGER NOT NULL DEFAULT 1,
  "incompleteReason"  TEXT,
  CONSTRAINT "ModelCallLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModelCallLog_at_idx"         ON "ModelCallLog" ("at");
CREATE INDEX IF NOT EXISTS "ModelCallLog_userId_at_idx"  ON "ModelCallLog" ("userId", "at");
CREATE INDEX IF NOT EXISTS "ModelCallLog_missionId_idx"  ON "ModelCallLog" ("missionId");
CREATE INDEX IF NOT EXISTS "ModelCallLog_threadId_idx"   ON "ModelCallLog" ("threadId");
CREATE INDEX IF NOT EXISTS "ModelCallLog_model_at_idx"   ON "ModelCallLog" ("model", "at");
CREATE INDEX IF NOT EXISTS "ModelCallLog_turnId_idx"     ON "ModelCallLog" ("turnId");

-- Un coût inconnu n'est pas un coût nul : la colonne accepte NULL, et ne fabrique plus de zéro.
ALTER TABLE "MissionWorkerRun" ALTER COLUMN "costUsd" DROP NOT NULL;
ALTER TABLE "MissionWorkerRun" ALTER COLUMN "costUsd" DROP DEFAULT;
