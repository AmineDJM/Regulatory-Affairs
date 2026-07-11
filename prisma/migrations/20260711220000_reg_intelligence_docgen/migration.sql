-- Regulatory Intelligence OS — G10 : documents générés (traçabilité template + twin). Idempotent.
CREATE TABLE IF NOT EXISTS "RegulatoryGeneratedDoc" (
  "id" TEXT NOT NULL,
  "dossierVersionId" TEXT NOT NULL,
  "templateCode" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "blobId" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "factsUsed" INTEGER NOT NULL DEFAULT 0,
  "factsMissing" INTEGER NOT NULL DEFAULT 0,
  "generatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryGeneratedDoc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryGeneratedDoc_dossierVersionId_idx" ON "RegulatoryGeneratedDoc"("dossierVersionId");
DO $$ BEGIN ALTER TABLE "RegulatoryGeneratedDoc" ADD CONSTRAINT "RegulatoryGeneratedDoc_dossierVersionId_fkey" FOREIGN KEY ("dossierVersionId") REFERENCES "RegulatoryDossierVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
