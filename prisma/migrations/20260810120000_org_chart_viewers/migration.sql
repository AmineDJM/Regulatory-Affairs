-- Consultation de l'organigramme ouverte par le Super Admin (rôles + personnes nommées). Idempotent.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "orgChartViewerRoles" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "orgChartViewerUserIds" TEXT[] NOT NULL DEFAULT '{}';
