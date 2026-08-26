-- ANNUAIRE INTERNE — les moyens de joindre les gens, avec leur provenance.
--
-- Idempotent : rejouable sans dommage (règle du projet — migrations SQL manuelles).
-- On ne touche à AUCUNE donnée existante : ces tables sont neuves, et les liens vers User /
-- Employee / CompanyContact sont facultatifs.

DO $$ BEGIN
  CREATE TYPE "DirectoryChannel" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "EndpointConfidence" AS ENUM ('VERIFIED_INTERNAL', 'VERIFIED_PROVIDER', 'OBSERVED_HISTORY', 'INFERRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DirectoryEntry" (
  "id"              TEXT PRIMARY KEY,
  "userId"          TEXT,
  "employeeId"      TEXT,
  "contactId"       TEXT,
  "displayName"     TEXT NOT NULL,
  "aliases"         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "jobTitle"        TEXT,
  "location"        TEXT,
  "companyId"       TEXT,
  "googleContactId" TEXT,
  "notes"           TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdById"     TEXT,
  "updatedById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DirectoryEntry_userId_key"     ON "DirectoryEntry"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "DirectoryEntry_employeeId_key" ON "DirectoryEntry"("employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "DirectoryEntry_contactId_key"  ON "DirectoryEntry"("contactId");
CREATE INDEX IF NOT EXISTS "DirectoryEntry_displayName_idx" ON "DirectoryEntry"("displayName");
CREATE INDEX IF NOT EXISTS "DirectoryEntry_isActive_idx"    ON "DirectoryEntry"("isActive");
CREATE INDEX IF NOT EXISTS "DirectoryEntry_companyId_idx"   ON "DirectoryEntry"("companyId");

DO $$ BEGIN
  ALTER TABLE "DirectoryEntry" ADD CONSTRAINT "DirectoryEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DirectoryEntry" ADD CONSTRAINT "DirectoryEntry_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DirectoryEntry" ADD CONSTRAINT "DirectoryEntry_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CompanyContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DirectoryEntry" ADD CONSTRAINT "DirectoryEntry_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DirectoryEndpoint" (
  "id"           TEXT PRIMARY KEY,
  "entryId"      TEXT NOT NULL,
  "channel"      "DirectoryChannel" NOT NULL,
  "value"        TEXT NOT NULL,
  "label"        TEXT,
  "confidence"   "EndpointConfidence" NOT NULL DEFAULT 'INFERRED',
  "isPrimary"    BOOLEAN NOT NULL DEFAULT false,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "source"       TEXT,
  "verifiedById" TEXT,
  "verifiedAt"   TIMESTAMP(3),
  "lastSeenAt"   TIMESTAMP(3),
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "DirectoryEndpoint_entryId_channel_value_key"
  ON "DirectoryEndpoint"("entryId", "channel", "value");
CREATE INDEX IF NOT EXISTS "DirectoryEndpoint_channel_value_idx"
  ON "DirectoryEndpoint"("channel", "value");
CREATE INDEX IF NOT EXISTS "DirectoryEndpoint_entryId_channel_isPrimary_idx"
  ON "DirectoryEndpoint"("entryId", "channel", "isPrimary");

DO $$ BEGIN
  ALTER TABLE "DirectoryEndpoint" ADD CONSTRAINT "DirectoryEndpoint_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "DirectoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
