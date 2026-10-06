-- L'identité du fournisseur recopiée du devis (Direction, 06/10 : « le fournisseur et toutes ses infos sont présents sur
-- le PDF, il faut tout lire »). Un devis dont le fournisseur n'a pas de fiche dans l'annuaire garde ici ce que le papier
-- imprime (raison sociale, adresse, NIF, RC, RIB, téléphone, e-mail) : le bon de commande le porte. Additive, idempotente.

ALTER TABLE "AdProDevis" ADD COLUMN IF NOT EXISTS "fournisseurLu" JSONB;
