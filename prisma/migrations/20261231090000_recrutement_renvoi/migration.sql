-- Audit 360°, lot C4d1 (R14 — §118.192) : une demande de recrutement se RENVOIE pour correction.
-- Idempotente. La valeur neuve n'est utilisée par aucune instruction de cette migration : elle n'est
-- donc pas lue dans la transaction qui l'ajoute.
ALTER TYPE "RecruitmentStage" ADD VALUE IF NOT EXISTS 'RETURNED';

ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "returnedFrom" "RecruitmentStage";
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "returnedById" TEXT;
ALTER TABLE "RecruitmentRequest" ADD COLUMN IF NOT EXISTS "returnNote" TEXT;
