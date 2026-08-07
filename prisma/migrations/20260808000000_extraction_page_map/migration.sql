-- CARTE DES PAGES de l'extraction : pageMap[i] = position (caractères) du début de la page i+1
-- dans `content`. C'est ce qui permet de convertir une position de texte en NUMÉRO DE PAGE EXACT
-- — et donc d'ouvrir le PDF à la page d'un constat au lieu d'une estimation à ±10 pages.
-- Nullable : les extractions antérieures n'en ont pas et retombent sur l'estimation.
ALTER TABLE "RegulatoryExtraction" ADD COLUMN IF NOT EXISTS "pageMap" JSONB;
