-- LE MESSAGE DU DEMANDEUR ET LA NOTE DE LA DIRECTION SONT DEUX CHOSES.
--
-- `orderNote` portait les deux : le demandeur y écrivait le contenu du bon de commande et ses
-- références, puis le visa de la Direction (ou son refus) l'ÉCRASAIT. Mesuré, la colonne avait
-- trois écrivains et AUCUN lecteur — donc rien ne le signalait.
--
-- On ne rétro-remplit RIEN : sur une ligne existante, on ne sait pas laquelle des deux paroles
-- la colonne porte, et deviner ferait passer un refus de la Direction pour le message du
-- demandeur. `orderNote` garde ce qu'elle porte, la nouvelle colonne part vide.
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderDecisionNote" TEXT;

-- LE LIEN CANONIQUE D'UNE DEMANDE DE DEVIS DÉJÀ OUVERTE.
--
-- `/demandes/[id]` lit `linkedEntityType` pour savoir qu'une dépense vient d'Ad & Pro et ne doit
-- PAS être imputée une seconde fois au budget d'un département. Les demandes de devis de poste
-- ne le posaient pas : le double comptage était donc possible, sans la moindre erreur visible.
UPDATE "AdministrativeRequest" AS r
SET "linkedEntityType" = 'AD_PRO_ITEM', "linkedEntityId" = i."id"
FROM "AdProItem" AS i
WHERE i."adminRequestId" = r."id" AND r."linkedEntityType" IS NULL;
