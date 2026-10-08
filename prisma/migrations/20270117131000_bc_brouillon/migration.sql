-- LE BROUILLON DU BON DE COMMANDE (Direction, 10/2026) : « il faut d'abord pré-valider le preview du BC par le demandeur ».
-- Le brouillon vit sur le devis (JSON) : aucun numéro attribué, aucune pièce au registre tant qu'il n'est pas validé.
ALTER TABLE "AdProDevis" ADD COLUMN IF NOT EXISTS "bcBrouillon" JSONB;
