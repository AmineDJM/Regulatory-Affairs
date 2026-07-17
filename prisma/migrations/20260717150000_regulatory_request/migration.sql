-- Demandes de l'information médicale (PRIM) vers l'équipe Regulatory, avec fil de discussion.
-- Idempotent.

DO $$ BEGIN
  CREATE TYPE "RegRequestCategory" AS ENUM ('QUESTION', 'DOCUMENT', 'STATUS_UPDATE', 'VARIATION', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RegRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ANSWERED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryRequest" (
  "id"           TEXT NOT NULL,
  "reference"    TEXT NOT NULL,
  "subject"      TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "category"     "RegRequestCategory" NOT NULL DEFAULT 'QUESTION',
  "priority"     "Priority" NOT NULL DEFAULT 'MEDIUM',
  "status"       "RegRequestStatus" NOT NULL DEFAULT 'OPEN',
  "productId"    TEXT,
  "requesterId"  TEXT,
  "assignedToId" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RegulatoryRequestMessage" (
  "id"        TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "authorId"  TEXT,
  "body"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRequestMessage_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  CREATE UNIQUE INDEX "RegulatoryRequest_reference_key" ON "RegulatoryRequest"("reference");
EXCEPTION WHEN duplicate_table THEN null; WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "RegulatoryRequest_status_idx" ON "RegulatoryRequest"("status");
CREATE INDEX IF NOT EXISTS "RegulatoryRequest_requesterId_idx" ON "RegulatoryRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "RegulatoryRequest_assignedToId_idx" ON "RegulatoryRequest"("assignedToId");
CREATE INDEX IF NOT EXISTS "RegulatoryRequest_productId_idx" ON "RegulatoryRequest"("productId");
CREATE INDEX IF NOT EXISTS "RegulatoryRequestMessage_requestId_idx" ON "RegulatoryRequestMessage"("requestId");

DO $$ BEGIN
  ALTER TABLE "RegulatoryRequest" ADD CONSTRAINT "RegulatoryRequest_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "RegulatoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryRequest" ADD CONSTRAINT "RegulatoryRequest_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryRequest" ADD CONSTRAINT "RegulatoryRequest_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryRequestMessage" ADD CONSTRAINT "RegulatoryRequestMessage_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "RegulatoryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryRequestMessage" ADD CONSTRAINT "RegulatoryRequestMessage_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
