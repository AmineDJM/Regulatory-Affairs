-- Test Center — Phase 5 : certification (§36) + différentiel (§32). Idempotent.

DO $$ BEGIN
  CREATE TYPE "TestCertification" AS ENUM ('CERTIFIED', 'CERTIFIED_WITH_RESERVATIONS', 'BLOCKED', 'INCONCLUSIVE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "certification" "TestCertification";
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "evidenceHash" TEXT;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "evidence" JSONB;
ALTER TABLE "TestRun" ADD COLUMN IF NOT EXISTS "differential" JSONB;
