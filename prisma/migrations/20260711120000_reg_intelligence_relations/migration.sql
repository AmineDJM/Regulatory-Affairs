-- Regulatory Intelligence OS — relations internes (contraintes FK + ON DELETE CASCADE).
-- Idempotent : chaque ADD CONSTRAINT est protégé (duplicate_object → no-op). Tables vides
-- à ce stade (créées en 20260710120000) → aucun risque d'orphelin.

DO $$ BEGIN
  ALTER TABLE "RegulatoryDossierVersion"
    ADD CONSTRAINT "RegulatoryDossierVersion_dossierId_fkey"
    FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryDocument"
    ADD CONSTRAINT "RegulatoryDocument_dossierVersionId_fkey"
    FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryJob"
    ADD CONSTRAINT "RegulatoryJob_dossierId_fkey"
    FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryJob"
    ADD CONSTRAINT "RegulatoryJob_dossierVersionId_fkey"
    FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryAuditLog"
    ADD CONSTRAINT "RegulatoryAuditLog_dossierId_fkey"
    FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
