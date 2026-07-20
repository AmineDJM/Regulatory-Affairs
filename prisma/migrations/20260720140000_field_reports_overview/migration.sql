-- Rôles autorisés (par le Super Admin) à voir l'onglet « Overview » des Rapports terrain
-- (graphes d'analyse : visites par médecin / hôpital / délégué / spécialité, tendance…).
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "fieldReportsOverviewRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
