-- Regulatory Intelligence OS — G13 : métadonnées OCR sur l'extraction. Idempotent.
ALTER TABLE "RegulatoryExtraction" ADD COLUMN IF NOT EXISTS "ocrConfidence" DOUBLE PRECISION;
ALTER TABLE "RegulatoryExtraction" ADD COLUMN IF NOT EXISTS "pageCount" INTEGER;
ALTER TABLE "RegulatoryExtraction" ADD COLUMN IF NOT EXISTS "ocrPages" JSONB;
ALTER TABLE "RegulatoryExtraction" ADD COLUMN IF NOT EXISTS "needsReview" BOOLEAN NOT NULL DEFAULT false;
