-- Système TEST → PRODUCTION : chaque nouveauté arrive en test et n'est visible que des
-- comptes en « mode test » ; l'administrateur la valide et elle passe en production.
-- Idempotent — sûr à rejouer.

DO $$ BEGIN
  CREATE TYPE "FeatureStage" AS ENUM ('TEST', 'PROD', 'OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "testMode" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "FeatureFlag" (
  "id"           TEXT NOT NULL,
  "key"          TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "description"  TEXT,
  "stage"        "FeatureStage" NOT NULL DEFAULT 'TEST',
  "promotedAt"   TIMESTAMP(3),
  "promotedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FeatureFlag_key_key" ON "FeatureFlag"("key");
CREATE INDEX IF NOT EXISTS "FeatureFlag_stage_idx" ON "FeatureFlag"("stage");

DO $$ BEGIN
  ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_promotedById_fkey"
    FOREIGN KEY ("promotedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
