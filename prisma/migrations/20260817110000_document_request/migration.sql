-- DEMANDER UNE PIÈCE À QUELQU'UN — n'importe qui, pas seulement le secrétariat.
-- La pièce qui manque n'est presque jamais chez celui qui en a besoin. Sans ce mécanisme, on la
-- réclame par message et l'on perd la trace de ce qu'on attend, de qui, depuis quand.
-- Idempotent — rejouable sans dommage.

DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'AD_PRO_ITEM';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_REQUEST';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'DECLINED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DocumentRequest" (
  "id"           TEXT PRIMARY KEY,
  "reference"    TEXT NOT NULL,
  "entityType"   "EntityType" NOT NULL,
  "entityId"     TEXT NOT NULL,
  "link"         TEXT,
  "label"        TEXT NOT NULL,
  "note"         TEXT,
  "dueDate"      TIMESTAMP(3),
  "askedById"    TEXT NOT NULL,
  "askedToId"    TEXT NOT NULL,
  "status"       "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "responseNote" TEXT,
  "submittedAt"  TIMESTAMP(3),
  "closedAt"     TIMESTAMP(3),
  "closedById"   TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentRequest_reference_key" ON "DocumentRequest"("reference");
CREATE INDEX IF NOT EXISTS "DocumentRequest_askedToId_status_idx" ON "DocumentRequest"("askedToId", "status");
CREATE INDEX IF NOT EXISTS "DocumentRequest_askedById_status_idx" ON "DocumentRequest"("askedById", "status");
CREATE INDEX IF NOT EXISTS "DocumentRequest_entity_idx" ON "DocumentRequest"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "DocumentRequest"
    ADD CONSTRAINT "DocumentRequest_askedById_fkey"
    FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DocumentRequest"
    ADD CONSTRAINT "DocumentRequest_askedToId_fkey"
    FOREIGN KEY ("askedToId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
