-- Formes de plans réussies (§64) — idempotent.
CREATE TABLE IF NOT EXISTS "MissionPlanPattern" (
  "id" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "profil" TEXT NOT NULL,
  "forme" JSONB NOT NULL,
  "succes" INTEGER NOT NULL DEFAULT 1,
  "statut" TEXT NOT NULL DEFAULT 'OBSERVED',
  "dernierMissionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MissionPlanPattern_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MissionPlanPattern_signature_key" ON "MissionPlanPattern"("signature");
CREATE INDEX IF NOT EXISTS "MissionPlanPattern_statut_succes_idx" ON "MissionPlanPattern"("statut", "succes");
