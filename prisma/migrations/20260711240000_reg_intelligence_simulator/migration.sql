-- Regulatory Intelligence OS — G11 : reviewer simulator (simulation non prédictive). Idempotent.
CREATE TABLE IF NOT EXISTS "RegulatorySimulation" (
  "id" TEXT NOT NULL,
  "dossierVersionId" TEXT NOT NULL,
  "perspectives" JSONB NOT NULL,
  "overall" TEXT,
  "configured" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySimulation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatorySimulation_dossierVersionId_idx" ON "RegulatorySimulation"("dossierVersionId");
DO $$ BEGIN ALTER TABLE "RegulatorySimulation" ADD CONSTRAINT "RegulatorySimulation_dossierVersionId_fkey" FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
