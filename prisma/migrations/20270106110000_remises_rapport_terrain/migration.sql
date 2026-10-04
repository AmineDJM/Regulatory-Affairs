-- LE MATÉRIEL REMIS DÉCLARÉ DANS UN COMPTE RENDU DE VISITE (§118.204) : un rapport terrain sans visite
-- derrière lui porte ses remises lui-même. Le lien est un CONTEXTE (SetNull, comme la visite) : le
-- registre du stock garde la vérité du mouvement, et l'action refuse de supprimer un rapport qui porte
-- des remises. Idempotente.
ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "fieldReportId" TEXT;

CREATE INDEX IF NOT EXISTS "PromoStockMovement_fieldReportId_idx" ON "PromoStockMovement"("fieldReportId");

DO $$ BEGIN
  ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_fieldReportId_fkey"
    FOREIGN KEY ("fieldReportId") REFERENCES "FieldReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
