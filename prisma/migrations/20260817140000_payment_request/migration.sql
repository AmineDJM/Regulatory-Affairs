-- DEMANDE DE PAIEMENT — le dossier qui part aux Finances : un montant, un bénéficiaire, une
-- échéance (ou une urgence), et LES PIÈCES qui le justifient. La discussion se tient pièce par
-- pièce, et le dossier reste vivant entre les tours. Idempotent — rejouable sans dommage.

DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PAYMENT_REQUEST';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ON_HOLD', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentUrgency" AS ENUM ('WHEN_POSSIBLE', 'THIS_MONTH', 'THIS_WEEK', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentPieceKind" AS ENUM ('INVOICE', 'PURCHASE_ORDER', 'QUOTE', 'DELIVERY_NOTE', 'CONTRACT', 'PROOF', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentPieceStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CHANGES_REQUESTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PaymentRequest" (
  "id"             TEXT PRIMARY KEY,
  "reference"      TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "amount"         DECIMAL(14, 2) NOT NULL,
  "payee"          TEXT NOT NULL,
  "recipientId"    TEXT,
  "companyId"      TEXT,
  "dueDate"        TIMESTAMP(3),
  "urgency"        "PaymentUrgency" NOT NULL DEFAULT 'WHEN_POSSIBLE',
  "status"         "PaymentRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "requesterId"    TEXT NOT NULL,
  "entityType"     "EntityType",
  "entityId"       TEXT,
  "link"           TEXT,
  "decidedById"    TEXT,
  "decidedAt"      TIMESTAMP(3),
  "decisionNote"   TEXT,
  "holdReason"     TEXT,
  "expenseOrderId" TEXT,
  "submittedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentRequest_reference_key" ON "PaymentRequest"("reference");
CREATE INDEX IF NOT EXISTS "PaymentRequest_status_idx" ON "PaymentRequest"("status");
CREATE INDEX IF NOT EXISTS "PaymentRequest_requesterId_idx" ON "PaymentRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "PaymentRequest_recipientId_status_idx" ON "PaymentRequest"("recipientId", "status");

DO $$ BEGIN
  ALTER TABLE "PaymentRequest"
    ADD CONSTRAINT "PaymentRequest_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PaymentPiece" (
  "id"           TEXT PRIMARY KEY,
  "requestId"    TEXT NOT NULL,
  "documentId"   TEXT NOT NULL,
  "kind"         "PaymentPieceKind" NOT NULL DEFAULT 'OTHER',
  "note"         TEXT,
  "status"       "PaymentPieceStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote"   TEXT,
  "reviewedById" TEXT,
  "reviewedAt"   TIMESTAMP(3),
  "replacesId"   TEXT,
  "position"     INTEGER NOT NULL DEFAULT 0,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentPiece_replacesId_key" ON "PaymentPiece"("replacesId");
CREATE INDEX IF NOT EXISTS "PaymentPiece_requestId_position_idx" ON "PaymentPiece"("requestId", "position");
CREATE INDEX IF NOT EXISTS "PaymentPiece_documentId_idx" ON "PaymentPiece"("documentId");

DO $$ BEGIN
  ALTER TABLE "PaymentPiece"
    ADD CONSTRAINT "PaymentPiece_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentPiece"
    ADD CONSTRAINT "PaymentPiece_replacesId_fkey"
    FOREIGN KEY ("replacesId") REFERENCES "PaymentPiece"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PaymentRequestEvent" (
  "id"        TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "actorId"   TEXT,
  "kind"      TEXT NOT NULL,
  "message"   TEXT,
  "pieceId"   TEXT,
  "at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PaymentRequestEvent_requestId_at_idx" ON "PaymentRequestEvent"("requestId", "at");

DO $$ BEGIN
  ALTER TABLE "PaymentRequestEvent"
    ADD CONSTRAINT "PaymentRequestEvent_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
