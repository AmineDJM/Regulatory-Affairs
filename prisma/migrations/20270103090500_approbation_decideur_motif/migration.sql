-- QUI A TRANCHÉ UNE VALIDATION AU SECRÉTARIAT, ET CE QU'IL A DIT (lot E5 — audit des managers, M14 et M15).
-- `AdminApproval` gardait la date d'une décision, jamais son auteur : un achat validé par l'intérimaire d'un
-- directeur, par la Direction ou par l'assistante (droit « Valider » du module) se lisait validé par le directeur
-- nommé. Et la parole du décideur écrasait celle du demandeur dans `comment` — ou, sans motif, l'estimation du
-- catalogue restait et se lisait comme l'avis du directeur. Deux colonnes : l'auteur (`SET NULL` : supprimer un
-- compte ne supprime pas la décision) et la parole du décideur. Idempotente ; rien n'est rempli : aucune décision
-- passée n'est attribuée par ressemblance (§118.36) — elle se lit « auteur inconnu ».
ALTER TABLE "AdminApproval" ADD COLUMN IF NOT EXISTS "decidedById" TEXT;
ALTER TABLE "AdminApproval" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminApproval_decidedById_fkey') THEN
    ALTER TABLE "AdminApproval"
      ADD CONSTRAINT "AdminApproval_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
