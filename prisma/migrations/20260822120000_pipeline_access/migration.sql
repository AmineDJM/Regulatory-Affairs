-- PIPELINE RÉGLEMENTAIRE — qui voit les dossiers VERROUILLÉS, qui tient le cadenas.
--
-- Jusqu'ici le Super Admin était seul à voir un dossier verrouillé : le portefeuille à l'étude
-- circulait donc par courriel, hors de l'outil — exactement ce que le verrou devait empêcher.
-- Deux listes de CONSULTATION et deux listes de CADENAS (rôles + personnes nommées) ; vides par
-- défaut, ce qui reproduit à l'identique le comportement actuel tant que rien n'est réglé.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "pipelineViewerRoles"    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "pipelineViewerUserIds"  TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "pipelineManagerRoles"   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "pipelineManagerUserIds" TEXT[] NOT NULL DEFAULT '{}';
