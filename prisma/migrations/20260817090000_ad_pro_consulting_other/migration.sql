-- AD & PRO : deux natures de plus — le CONSULTING (contrats entre deux parties) et AUTRE
-- (la demande qui n'entre dans aucune case). Idempotent : rejouable sans dommage.

-- ─────────────── Types d'entité : pièces jointes et journal ───────────────
DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'CONSULTING_CONTRACT';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'AD_PRO_OTHER';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ─────────────── Énumérations propres au consulting ───────────────
DO $$ BEGIN
  CREATE TYPE "ConsultingStatus" AS ENUM ('DRAFT', 'AWAITING_VALIDATION', 'ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ConsultingBilling" AS ENUM ('ONE_OFF', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ON_DELIVERY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdProOtherStatus" AS ENUM ('DRAFT', 'AWAITING_DECISION', 'APPROVED', 'REFUSED', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────── Contrats de consulting ───────────────
CREATE TABLE IF NOT EXISTS "ConsultingContract" (
  "id"                  TEXT PRIMARY KEY,
  "reference"           TEXT NOT NULL,
  "title"               TEXT NOT NULL,
  "counterparty"        TEXT NOT NULL,
  "counterpartyContact" TEXT,
  "companyId"           TEXT,
  "scope"               TEXT,
  "startDate"           TIMESTAMP(3),
  "endDate"             TIMESTAMP(3),
  "amount"              DECIMAL(14, 2),
  "billing"             "ConsultingBilling" NOT NULL DEFAULT 'ONE_OFF',
  "paymentTerms"        TEXT,
  "status"              "ConsultingStatus" NOT NULL DEFAULT 'DRAFT',
  "requesterId"         TEXT,
  "validatorId"         TEXT,
  "validatedById"       TEXT,
  "validatedAt"         TIMESTAMP(3),
  "decisionNote"        TEXT,
  "cancelledAt"         TIMESTAMP(3),
  "notes"               TEXT,
  "createdById"         TEXT,
  "updatedById"         TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConsultingContract_reference_key" ON "ConsultingContract"("reference");
CREATE INDEX IF NOT EXISTS "ConsultingContract_status_idx" ON "ConsultingContract"("status");
CREATE INDEX IF NOT EXISTS "ConsultingContract_requesterId_idx" ON "ConsultingContract"("requesterId");
CREATE INDEX IF NOT EXISTS "ConsultingContract_validatorId_idx" ON "ConsultingContract"("validatorId");
CREATE INDEX IF NOT EXISTS "ConsultingContract_companyId_idx" ON "ConsultingContract"("companyId");

DO $$ BEGIN
  ALTER TABLE "ConsultingContract"
    ADD CONSTRAINT "ConsultingContract_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────── Tâches attendues du prestataire ───────────────
CREATE TABLE IF NOT EXISTS "ConsultingTask" (
  "id"         TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "dueDate"    TIMESTAMP(3),
  "doneAt"     TIMESTAMP(3),
  "position"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ConsultingTask_contractId_idx" ON "ConsultingTask"("contractId");

DO $$ BEGIN
  ALTER TABLE "ConsultingTask"
    ADD CONSTRAINT "ConsultingTask_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "ConsultingContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────── Demandes « Autre » ───────────────
CREATE TABLE IF NOT EXISTS "AdProOtherRequest" (
  "id"           TEXT PRIMARY KEY,
  "reference"    TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "beneficiary"  TEXT,
  "amount"       DECIMAL(14, 2),
  "companyId"    TEXT,
  "status"       "AdProOtherStatus" NOT NULL DEFAULT 'AWAITING_DECISION',
  "requesterId"  TEXT,
  "decidedById"  TEXT,
  "decidedAt"    TIMESTAMP(3),
  "decisionNote" TEXT,
  "createdById"  TEXT,
  "updatedById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdProOtherRequest_reference_key" ON "AdProOtherRequest"("reference");
CREATE INDEX IF NOT EXISTS "AdProOtherRequest_status_idx" ON "AdProOtherRequest"("status");
CREATE INDEX IF NOT EXISTS "AdProOtherRequest_requesterId_idx" ON "AdProOtherRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "AdProOtherRequest_companyId_idx" ON "AdProOtherRequest"("companyId");

DO $$ BEGIN
  ALTER TABLE "AdProOtherRequest"
    ADD CONSTRAINT "AdProOtherRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
