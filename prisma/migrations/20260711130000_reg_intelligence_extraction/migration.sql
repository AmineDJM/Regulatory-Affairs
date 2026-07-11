-- Regulatory Intelligence OS — Phase 2 : texte extrait par document. Idempotent.

CREATE TABLE IF NOT EXISTS "RegulatoryExtraction" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "lang" TEXT,
  "charCount" INTEGER NOT NULL DEFAULT 0,
  "truncated" BOOLEAN NOT NULL DEFAULT false,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryExtraction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryExtraction_documentId_key" ON "RegulatoryExtraction"("documentId");

DO $$ BEGIN
  ALTER TABLE "RegulatoryExtraction"
    ADD CONSTRAINT "RegulatoryExtraction_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "RegulatoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
