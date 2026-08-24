-- Le corpus de connaissance se GÉNÉRALISE : une catégorie par source (Droit du travail,
-- Droit fiscal, ANPP, MIPH, Enregistrement, Marchés publics / PCH, Interne…). Idempotent.

ALTER TABLE "RegulatorySource" ADD COLUMN IF NOT EXISTS "category" TEXT;
CREATE INDEX IF NOT EXISTS "RegulatorySource_category_idx" ON "RegulatorySource"("category");
