-- Upload direct S3/R2 (chantier 1) : clé objet du bucket pour une session en mode DIRECT.
-- Idempotent : sûr à ré-appliquer.
ALTER TABLE "RegulatoryUploadSession" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
