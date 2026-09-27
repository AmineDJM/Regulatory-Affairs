-- §118.150 — Le pôle d'un contrat de consulting : Ad & Pro (défaut) ou Ressources humaines.
-- Idempotente : relançable sans effet. Aucune ligne existante ne change de pôle — le transfert
-- est un GESTE (bouton sur la fiche, ou Adam), jamais une migration : c'est une personne habilitée
-- qui décide qu'un contrat relève des RH, pas un déploiement.
DO $$ BEGIN
  CREATE TYPE "ConsultingPole" AS ENUM ('AD_PRO', 'RH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ConsultingContract" ADD COLUMN IF NOT EXISTS "pole" "ConsultingPole" NOT NULL DEFAULT 'AD_PRO';
CREATE INDEX IF NOT EXISTS "ConsultingContract_pole_idx" ON "ConsultingContract"("pole");
