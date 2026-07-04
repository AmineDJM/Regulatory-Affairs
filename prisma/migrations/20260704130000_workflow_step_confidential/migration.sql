-- Étape de workflow « confidentielle » : avis & montant masqués au demandeur (délégué).
ALTER TABLE "WorkflowStep" ADD COLUMN IF NOT EXISTS "confidential" BOOLEAN NOT NULL DEFAULT false;
