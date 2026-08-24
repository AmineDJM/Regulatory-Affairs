-- LE CIRCUIT COURT DU MATÉRIEL PROMOTIONNEL — cinq étapes au lieu de seize.
--
-- L'ancien circuit enchaînait seize statuts en file indienne, chacun attendant le précédent : un
-- poster mettait deux mois à sortir et personne ne savait chez qui il dormait. Le nouveau tient en
-- une chaîne de validation courte (demandeur → N+1 → PDG ou Super Admin → information médicale),
-- puis OUVRE trois chantiers qui avancent EN MÊME TEMPS : bon de commande, demande de paiement,
-- demande de visa publicitaire. C'est là qu'est le vrai gain — ces trois-là n'ont aucune raison de
-- s'attendre.
--
-- L'ancien `status` N'EST PAS supprimé : les dossiers en cours le portent, et l'historique s'y
-- lit. Les deux cohabitent, `circuitState` pilotant les nouveaux dossiers.

ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "circuitState" TEXT;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "managerId" TEXT;
ALTER TABLE "PromoMaterial" ADD COLUMN IF NOT EXISTS "tracksDone" TEXT;

CREATE INDEX IF NOT EXISTS "PromoMaterial_circuitState_idx" ON "PromoMaterial"("circuitState");
CREATE INDEX IF NOT EXISTS "PromoMaterial_managerId_idx" ON "PromoMaterial"("managerId");
