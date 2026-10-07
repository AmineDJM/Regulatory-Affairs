-- SEGMENTATION PAR SECTEUR DE LA BU (Direction, 07/10) : une fiche peut être rangée À LA MAIN dans un secteur de la BU.
-- Nul = le secteur se déduit de l'établissement / du service du praticien. Idempotente.

ALTER TABLE "SegmentationFiche" ADD COLUMN IF NOT EXISTS "secteurId" TEXT;

CREATE INDEX IF NOT EXISTS "SegmentationFiche_secteurId_idx" ON "SegmentationFiche"("secteurId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SegmentationFiche_secteurId_fkey') THEN
    ALTER TABLE "SegmentationFiche"
      ADD CONSTRAINT "SegmentationFiche_secteurId_fkey"
      FOREIGN KEY ("secteurId") REFERENCES "SalesSector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
