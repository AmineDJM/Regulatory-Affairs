-- ANNUAIRE MÉDICAL : colonnes attendues — wilaya, adresse, code postal, nom/prénom séparés.
-- Idempotent.
ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "wilaya" TEXT;
ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
