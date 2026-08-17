-- Legal (documents légaux + bons de commande), Courriers (registre entrant/sortant), Factures.
-- Idempotent : rejouable sur une instance déjà migrée.

DO $$ BEGIN
  CREATE TYPE "LegalDocKind" AS ENUM ('CONTRACT','PURCHASE_ORDER','AGREEMENT','NDA','INSURANCE','LICENSE','LEASE','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LegalDocStatus" AS ENUM ('ACTIVE','EXPIRED','RENEWED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MailDirection" AS ENUM ('INCOMING','OUTGOING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID','PARTIAL','PAID','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "LegalDocument" (
  "custom"         JSONB,
  "id"             TEXT NOT NULL,
  "companyId"      TEXT,
  "reference"      TEXT,
  "title"          TEXT NOT NULL,
  "kind"           "LegalDocKind" NOT NULL DEFAULT 'CONTRACT',
  "counterparty"   TEXT,
  "startDate"      TIMESTAMP(3),
  "endDate"        TIMESTAMP(3),
  "status"         "LegalDocStatus" NOT NULL DEFAULT 'ACTIVE',
  "amount"         DECIMAL(14,2),
  "notes"          TEXT,
  "cancelledAt"    TIMESTAMP(3),
  "cancelReason"   TEXT,
  "renewedFromId"  TEXT,
  "driveNodeId"    TEXT,
  "sourceType"     "EntityType",
  "sourceId"       TEXT,
  "lastRemindedAt" TIMESTAMP(3),
  "createdById"    TEXT,
  "updatedById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MailEntry" (
  "custom"         JSONB,
  "id"             TEXT NOT NULL,
  "companyId"      TEXT,
  "reference"      TEXT,
  "title"          TEXT NOT NULL,
  "direction"      "MailDirection" NOT NULL,
  "sender"         TEXT,
  "recipient"      TEXT,
  "sentAt"         TIMESTAMP(3),
  "receivedAt"     TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "carrier"        TEXT,
  "notes"          TEXT,
  "sourceType"     "EntityType",
  "sourceId"       TEXT,
  "createdById"    TEXT,
  "updatedById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Invoice" (
  "custom"      JSONB,
  "id"          TEXT NOT NULL,
  "companyId"   TEXT,
  "number"      TEXT,
  "title"       TEXT NOT NULL,
  "issueDate"   TIMESTAMP(3),
  "dueDate"     TIMESTAMP(3),
  "paidDate"    TIMESTAMP(3),
  "amount"      DECIMAL(14,2),
  "status"      "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
  "recipient"   TEXT,
  "payer"       TEXT,
  "notes"       TEXT,
  "sourceType"  "EntityType",
  "sourceId"    TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegalDocument_companyId_status_idx"  ON "LegalDocument"("companyId","status");
CREATE INDEX IF NOT EXISTS "LegalDocument_kind_idx"              ON "LegalDocument"("kind");
CREATE INDEX IF NOT EXISTS "LegalDocument_endDate_idx"           ON "LegalDocument"("endDate");
CREATE INDEX IF NOT EXISTS "LegalDocument_sourceType_sourceId_idx" ON "LegalDocument"("sourceType","sourceId");
CREATE INDEX IF NOT EXISTS "LegalDocument_driveNodeId_idx"       ON "LegalDocument"("driveNodeId");
CREATE INDEX IF NOT EXISTS "MailEntry_companyId_direction_idx"   ON "MailEntry"("companyId","direction");
CREATE INDEX IF NOT EXISTS "MailEntry_sentAt_idx"                ON "MailEntry"("sentAt");
CREATE INDEX IF NOT EXISTS "MailEntry_receivedAt_idx"            ON "MailEntry"("receivedAt");
CREATE INDEX IF NOT EXISTS "MailEntry_sourceType_sourceId_idx"   ON "MailEntry"("sourceType","sourceId");
CREATE INDEX IF NOT EXISTS "Invoice_companyId_status_idx"        ON "Invoice"("companyId","status");
CREATE INDEX IF NOT EXISTS "Invoice_issueDate_idx"               ON "Invoice"("issueDate");
CREATE INDEX IF NOT EXISTS "Invoice_paidDate_idx"                ON "Invoice"("paidDate");
CREATE INDEX IF NOT EXISTS "Invoice_sourceType_sourceId_idx"     ON "Invoice"("sourceType","sourceId");

DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_renewedFromId_fkey"
    FOREIGN KEY ("renewedFromId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_driveNodeId_fkey"
    FOREIGN KEY ("driveNodeId") REFERENCES "DriveNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MailEntry" ADD CONSTRAINT "MailEntry_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MailEntry" ADD CONSTRAINT "MailEntry_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
