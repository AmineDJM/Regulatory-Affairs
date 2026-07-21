-- Limites d'upload trop basses (25 Mo Documents / 100 Mo Drive) : un ZIP de dossier entier
-- montait à 100 % puis « échec » (rejet serveur pour taille). On relève les valeurs par défaut
-- des colonnes ET la ligne de réglages existante (GREATEST = ne baisse jamais un réglage volontaire).
ALTER TABLE "AppSetting" ALTER COLUMN "maxUploadMb" SET DEFAULT 200;
ALTER TABLE "AppSetting" ALTER COLUMN "maxDriveUploadMb" SET DEFAULT 1024;

UPDATE "AppSetting"
SET "maxUploadMb" = GREATEST("maxUploadMb", 200),
    "maxDriveUploadMb" = GREATEST("maxDriveUploadMb", 1024)
WHERE id = 'global';
