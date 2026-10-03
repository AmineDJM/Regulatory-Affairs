-- Audit 360°, lot C4d2a (§118.193) — un plan de tournée validé se révise, une visite se dit non tenue.
-- Idempotente : chaque ligne se rejoue sans effet. La valeur d'énumération n'est utilisée par aucune
-- instruction de cette migration (une valeur neuve ne sert pas dans la transaction qui l'ajoute).
ALTER TYPE "TourPlanStatus" ADD VALUE IF NOT EXISTS 'REVISION';
ALTER TABLE "TourPlan" ADD COLUMN IF NOT EXISTS "revisionNote" TEXT;
ALTER TABLE "TourPlan" ADD COLUMN IF NOT EXISTS "revisionRequestedAt" TIMESTAMP(3);
ALTER TABLE "TourPlan" ADD COLUMN IF NOT EXISTS "revisionRequestedById" TEXT;
ALTER TABLE "TourPlan" ADD COLUMN IF NOT EXISTS "revisionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MedicalVisit" ADD COLUMN IF NOT EXISTS "notHeldReason" TEXT;
ALTER TABLE "MedicalVisit" ADD COLUMN IF NOT EXISTS "notHeldAt" TIMESTAMP(3);
ALTER TABLE "MedicalVisit" ADD COLUMN IF NOT EXISTS "notHeldById" TEXT;
