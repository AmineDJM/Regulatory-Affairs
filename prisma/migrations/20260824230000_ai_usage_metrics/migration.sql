-- Observabilité de la boucle agent (assistant / Chief of Staff) : délai avant le premier mot,
-- tours, appels d'outils, erreurs d'outils, temps passé dans les outils. Idempotent.
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "ttftMs" INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "turns" INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "toolCalls" INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "toolErrors" INTEGER;
ALTER TABLE "AiUsageLog" ADD COLUMN IF NOT EXISTS "toolLatencyMs" INTEGER;
