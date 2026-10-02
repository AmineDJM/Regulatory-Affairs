-- Graphe AMD, phase 1B (§118.181) — les types d'entité d'audit qui manquaient.
--
-- Une Business Unit, un plan de tournée, un secteur commercial, un établissement et une spécialité
-- s'auditaient SANS type d'entité (ou, pour le plan de tournée, sous le type VISIT avec l'identifiant
-- du PLAN) : rien ne pouvait relire l'historique d'un de ces objets par son identifiant.
--
-- Une valeur d'énumération neuve ne peut pas servir dans la transaction qui l'ajoute : la
-- requalification de l'historique vit donc dans la migration SUIVANTE.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'BUSINESS_UNIT';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'TOUR_PLAN';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SALES_SECTOR';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'INSTITUTION';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'SPECIALTY';
