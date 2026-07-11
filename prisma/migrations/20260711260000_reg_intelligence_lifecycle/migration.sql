-- Regulatory Intelligence OS — G12 : lifecycle (événements + obligations). Idempotent.
DO $$ BEGIN CREATE TYPE "RegLifecycleKind" AS ENUM ('SUBMISSION','SEQUENCE','SUPPLEMENT','MODIFICATION','RENEWAL','RESPONSE','APPROVED','WITHDRAWAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegLifecycleOperation" AS ENUM ('NEW','REPLACE','DELETE','APPEND'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "RegObligationStatus" AS ENUM ('OPEN','DONE','OVERDUE'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryLifecycleEvent" (
  "id" TEXT NOT NULL,
  "dossierId" TEXT NOT NULL,
  "kind" "RegLifecycleKind" NOT NULL,
  "sequenceNo" INTEGER,
  "operation" "RegLifecycleOperation",
  "label" TEXT NOT NULL,
  "note" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryLifecycleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryLifecycleEvent_dossierId_idx" ON "RegulatoryLifecycleEvent"("dossierId");

CREATE TABLE IF NOT EXISTS "RegulatoryObligation" (
  "id" TEXT NOT NULL,
  "dossierId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "certType" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" "RegObligationStatus" NOT NULL DEFAULT 'OPEN',
  "note" TEXT,
  "createdById" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryObligation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryObligation_dossierId_idx" ON "RegulatoryObligation"("dossierId");
CREATE INDEX IF NOT EXISTS "RegulatoryObligation_status_idx" ON "RegulatoryObligation"("status");

DO $$ BEGIN ALTER TABLE "RegulatoryLifecycleEvent" ADD CONSTRAINT "RegulatoryLifecycleEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "RegulatoryObligation" ADD CONSTRAINT "RegulatoryObligation_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
