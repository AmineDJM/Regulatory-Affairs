-- Regulatory Intelligence OS — Phase 6 : revue humaine des constats (justification/traçabilité). Idempotent.

ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
