-- Conditionnement d'un dossier réglementaire (« B/30 », « Tube 30 G »).
-- À dosage et forme identiques, c'est le conditionnement qui distingue deux dossiers :
-- une boîte de 28 et une boîte de 56 sont deux enregistrements distincts.
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "packaging" TEXT;
