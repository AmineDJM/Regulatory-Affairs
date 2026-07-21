-- CORRECTIF FIABLE (prod) : garantir que la ligne de réglages EXISTE avec des limites d'upload
-- généreuses. La migration précédente ne faisait qu'UPDATE — si la ligne n'existait pas encore
-- (jamais enregistrée depuis l'admin), getAppSettings retombait sur le défaut, qui lit la variable
-- d'environnement MAX_UPLOAD_MB (= 25 sur Render) → un ZIP de dossier échouait toujours à 100 %.
-- Ici on CRÉE la ligne si absente (les autres colonnes prennent leurs valeurs par défaut) et on la
-- relève si elle existe (GREATEST : ne baisse jamais un réglage volontaire). Idempotent.
INSERT INTO "AppSetting" (id, "maxUploadMb", "maxDriveUploadMb", "updatedAt")
VALUES ('global', 200, 1024, NOW())
ON CONFLICT (id) DO UPDATE
  SET "maxUploadMb" = GREATEST("AppSetting"."maxUploadMb", 200),
      "maxDriveUploadMb" = GREATEST("AppSetting"."maxDriveUploadMb", 1024);
