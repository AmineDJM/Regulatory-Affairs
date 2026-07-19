-- Décision granulaire d'un validateur, élément par élément (message + chaque pièce jointe).
-- itemKey = "MESSAGE" ou l'id du Document. Décision approuvée / refusée / à réviser + commentaire optionnel.
CREATE TABLE IF NOT EXISTS "ValidationItemDecision" (
  "id"        TEXT NOT NULL,
  "stepId"    TEXT NOT NULL,
  "itemKey"   TEXT NOT NULL,
  "decision"  "ValidationStepState" NOT NULL,
  "comment"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ValidationItemDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ValidationItemDecision_stepId_itemKey_key" ON "ValidationItemDecision"("stepId", "itemKey");
CREATE INDEX IF NOT EXISTS "ValidationItemDecision_stepId_idx" ON "ValidationItemDecision"("stepId");
DO $$ BEGIN
  ALTER TABLE "ValidationItemDecision" ADD CONSTRAINT "ValidationItemDecision_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "ValidationStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
