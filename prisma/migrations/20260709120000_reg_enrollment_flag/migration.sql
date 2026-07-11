-- Onglet Regulatory « Enregistrement » (analyseur CTD) : masqué tant que le Super Admin
-- ne l'a pas débloqué. Idempotent.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "regEnrollmentEnabled" BOOLEAN NOT NULL DEFAULT false;
