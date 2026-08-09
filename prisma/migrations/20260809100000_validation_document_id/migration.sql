-- Validation d'une pièce jointe précise (Bureau du secrétariat). Idempotent.
ALTER TABLE "ValidationRequest" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
CREATE INDEX IF NOT EXISTS "ValidationRequest_documentId_idx" ON "ValidationRequest"("documentId");
