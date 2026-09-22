-- AD & PRO — LE CONSULTING ET « AUTRE DEMANDE » REÇOIVENT LA GAMME, LE PRATICIEN ET LE PRODUIT.
--
-- Décision de la Direction (22/09/2026) : « dans la nouvelle demande dans Ad&Pro (hors matériel
-- promotionnel), on doit pouvoir sélectionner un ou plusieurs médecins et un ou plusieurs
-- produits concernés. »
--
-- Le défaut trouvé en chemin est plus grave que celui qu'on corrige : `consultingCreateFields`
-- et `adProOtherCreateFields` posaient déjà un menu « Business Unit » OBLIGATOIRE, et NI le
-- modèle NI l'action n'avaient ce champ — le choix imposé au demandeur était donc JETÉ. Un champ
-- requis sans effet est pire qu'un champ absent : il fait croire que la dépense est rattachée.
--
-- Idempotent : `IF NOT EXISTS` sur les colonnes, et la contrainte de clé étrangère n'est posée
-- que si elle n'existe pas déjà (un redéploiement ne doit pas échouer sur un doublon).

ALTER TABLE "ConsultingContract" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
ALTER TABLE "ConsultingContract" ADD COLUMN IF NOT EXISTS "doctor" TEXT;
ALTER TABLE "ConsultingContract" ADD COLUMN IF NOT EXISTS "product" TEXT;

ALTER TABLE "AdProOtherRequest" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
ALTER TABLE "AdProOtherRequest" ADD COLUMN IF NOT EXISTS "doctor" TEXT;
ALTER TABLE "AdProOtherRequest" ADD COLUMN IF NOT EXISTS "product" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ConsultingContract_businessUnitId_fkey'
  ) THEN
    ALTER TABLE "ConsultingContract"
      ADD CONSTRAINT "ConsultingContract_businessUnitId_fkey"
      FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdProOtherRequest_businessUnitId_fkey'
  ) THEN
    ALTER TABLE "AdProOtherRequest"
      ADD CONSTRAINT "AdProOtherRequest_businessUnitId_fkey"
      FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ON NE REMPLIT RIEN. Une demande déjà déposée n'a pas de gamme parce que personne ne la lui a
-- donnée ; la déduire aujourd'hui du rôle de son demandeur imputerait sa dépense à un budget que
-- personne n'a choisi (§118.142 : la migration du tamis ne rétro-remplissait pas non plus).
