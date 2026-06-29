-- Rattacher un document à une étape précise du processus ANPP (Regulatory).
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "stepKey" TEXT;
CREATE INDEX IF NOT EXISTS "Document_entityType_entityId_stepKey_idx" ON "Document" ("entityType", "entityId", "stepKey");
