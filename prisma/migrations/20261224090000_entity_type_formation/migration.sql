-- Audit 360° (§118.184) — une FORMATION a son propre type d'entité.
--
-- Les pièces d'une formation (devis, programme, convention) et son historique s'écrivaient sous le
-- type DOSSIER — un « sujet » de Pilotage — avec l'identifiant de la FORMATION. La porte des pièces
-- (`canAccessEntity`) cherchait donc un sujet portant cet identifiant, n'en trouvait aucun, et
-- refusait le téléchargement à tout le monde : un devis de formation joint ne se rouvrait jamais.
--
-- Une valeur d'énumération neuve ne peut pas servir dans la transaction qui l'ajoute : la
-- requalification des pièces vit dans la migration SUIVANTE.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'TRAINING';
