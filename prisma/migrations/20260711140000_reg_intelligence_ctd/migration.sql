-- Regulatory Intelligence OS — Phase 3 : classification CTD (colonnes sur RegulatoryDocument). Idempotent.

ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "ctdModule" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "ctdSection" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "ctdConfidence" DOUBLE PRECISION;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "classificationMethod" TEXT;
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_ctdSection_idx" ON "RegulatoryDocument"("ctdSection");
