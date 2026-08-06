-- FINDINGS — exigences de qualité : un constat sans preuve ni règle n'est pas défendable
-- devant l'ANPP. Colonnes ADDITIVES et idempotentes ; aucun finding existant n'est modifié.

ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "ruleRef"           TEXT;
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "confidence"        DOUBLE PRECISION;
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "page"              INTEGER;
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "excerpt"           TEXT;
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "conflictingValues" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "recommendation"    TEXT;
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "similarReserveIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "RegulatoryFinding" ADD COLUMN IF NOT EXISTS "reserveRisk"       DOUBLE PRECISION;
