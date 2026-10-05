-- BILLETTERIE — NOM ET PRÉNOM SÉPARÉS, TRAJET À PLUSIEURS DESTINATIONS (Direction, 05/10/2026).
--
-- Idempotente. Rien n'est réécrit : un voyageur d'avant garde son nom COMPLET dans `nom` et un
-- `prenom` vide (on ne devine pas où couper « Mohamed El Amine Benali »), et un trajet d'avant reste
-- ALLER_RETOUR ou ALLER_SIMPLE, sans étapes. La valeur d'énumération n'est pas utilisée dans cette
-- transaction : elle ne sert qu'aux saisies d'après.

ALTER TYPE "AdProTrajet" ADD VALUE IF NOT EXISTS 'MULTI_DESTINATIONS';

ALTER TABLE "AdProVoyageur" ADD COLUMN IF NOT EXISTS "prenom" TEXT;
ALTER TABLE "AdProVoyageur" ADD COLUMN IF NOT EXISTS "segments" JSONB;
