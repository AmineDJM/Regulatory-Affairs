-- Onglet « Enregistrement (CTD) » : réservé à l'administrateur, ouvrable à des rôles précis. Idempotent.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "regEnrollmentRoles" TEXT[] NOT NULL DEFAULT '{}';
