-- Archivage « Dossier traité » (Drive) des demandes traitées — idempotent.
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "archivedNodeId" TEXT;
ALTER TABLE "AdministrativeRequest" ADD COLUMN IF NOT EXISTS "archivedNodeId" TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "archivedNodeId" TEXT;
