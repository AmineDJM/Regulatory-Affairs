-- Audit 360°, lot C4b (§118.190) — le renvoi pour correction d'un dossier de matériel
-- promotionnel (R05) et la correction d'un comptage saisi (R19). Idempotente : rejouée, elle ne
-- change rien.
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "returnedById" TEXT;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "returnNote" TEXT;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "returnedFrom" TEXT;

ALTER TABLE "PromoStockComptage" ADD COLUMN IF NOT EXISTS "corrigeLe" TIMESTAMP(3);
ALTER TABLE "PromoStockComptage" ADD COLUMN IF NOT EXISTS "corrigeParId" TEXT;
ALTER TABLE "PromoStockComptage" ADD COLUMN IF NOT EXISTS "corrigeMotif" TEXT;
