-- Run 4 : contrôle des missions durables — priorité, bail multi-instances, plafond de modèle.
-- Idempotent : chaque colonne n'est ajoutée que si elle manque.

ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "leaseOwner" TEXT;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "leaseUntil" TIMESTAMP(3);
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "modelCallsCap" INTEGER;

CREATE INDEX IF NOT EXISTS "Mission_status_priority_idx" ON "Mission"("status", "priority" DESC);
