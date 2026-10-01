-- §118.163 — un projet BD appartient à UNE société du groupe (« chaque projet associé à une
-- société/entité, et donc visible »). Idempotent : rejouable sans effet.
--
-- Aucune ligne n'est rattachée ici. Décider à quelle société appartient un projet est un geste
-- d'une personne, pas d'un déploiement : l'écran « Projets » PROPOSE l'entité de ses dossiers,
-- et c'est quelqu'un qui l'enregistre. Un projet sans entité reste visible (`companyScopedWhere`
-- garde les lignes non rattachées), il ne disparaît de rien.
ALTER TABLE "BdProject" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

CREATE INDEX IF NOT EXISTS "BdProject_companyId_idx" ON "BdProject"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BdProject_companyId_fkey') THEN
    ALTER TABLE "BdProject" ADD CONSTRAINT "BdProject_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
