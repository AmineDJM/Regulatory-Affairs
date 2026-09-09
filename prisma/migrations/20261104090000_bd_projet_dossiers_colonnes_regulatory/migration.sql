-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE PROJET BD CLASSE LE DOSSIER, ET LES COLONNES DU TABLEAU DEVIENNENT UN RÉGLAGE
--
-- 1) `RegulatoryProduct.bdProjectId` — chaque dossier réglementaire peut appartenir à un PROJET
--    stratégique nommé dans Business Development. On réutilise `BdProject` plutôt que d'ouvrir
--    un second registre : deux listes de projets divergeraient au premier renommage, et « ce
--    dossier appartient-il au projet Oncologie 2027 ? » n'aurait plus une seule réponse.
--
--    ON DELETE SET NULL : perdre le classement d'un dossier est réparable, perdre le dossier
--    avec le projet ne l'est pas.
--
-- 2) `AppSetting.regulatoryHiddenColumns` — les colonnes retirées du tableau Regulatory sur les
--    DEUX sous-modules (Suivi de dossiers et Pipeline), pour tout le monde. À distinguer de la
--    préférence d'affichage locale au navigateur : celle-ci dit « je ne veux pas voir ça sur MON
--    écran », celle-là « cette colonne n'a pas lieu d'être dans cette maison ».
--
-- IDEMPOTENT : rejouable sans effet sur une base déjà à jour.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "bdProjectId" TEXT;

CREATE INDEX IF NOT EXISTS "RegulatoryProduct_bdProjectId_idx" ON "RegulatoryProduct"("bdProjectId");

-- La contrainte se pose une seule fois : `ADD CONSTRAINT` n'a pas d'`IF NOT EXISTS` en
-- PostgreSQL, d'où le bloc conditionnel — un rejeu ne doit pas faire échouer le déploiement.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RegulatoryProduct_bdProjectId_fkey'
  ) THEN
    ALTER TABLE "RegulatoryProduct"
      ADD CONSTRAINT "RegulatoryProduct_bdProjectId_fkey"
      FOREIGN KEY ("bdProjectId") REFERENCES "BdProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "regulatoryHiddenColumns" TEXT[] NOT NULL DEFAULT '{}';
