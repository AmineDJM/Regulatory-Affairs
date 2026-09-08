-- D'OÙ VIENT LE TEXTE D'UNE SOURCE DU CORPUS (§118.63).
--
-- L'ingestion du corpus refusait les scans en renvoyant la personne les océriser elle-même,
-- alors que le moteur OCR du répertoire voisin tournait déjà en production. Maintenant qu'elle
-- les lit, il faut pouvoir DIRE qu'un texte vient d'une reconnaissance de caractères : une
-- source lue à 63 % de confiance ne se cite pas comme un arrêté copié du Journal officiel.
--
-- NULL = texte natif (le cas de tout l'existant), donc rien à rétro-remplir.
ALTER TABLE "RegulatorySourceVersion"
  ADD COLUMN IF NOT EXISTS "extractionMethod" TEXT;

ALTER TABLE "RegulatorySourceVersion"
  ADD COLUMN IF NOT EXISTS "extractionConfidence" DOUBLE PRECISION;
