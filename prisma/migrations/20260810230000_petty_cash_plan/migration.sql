-- Caisse d'avance : réglage MENSUEL (montant, jour de rechargement, détentrice) posé par les
-- ressources humaines, et demandes de RALLONGE réellement décidables (accordée avec le montant
-- écrit par les RH, ou refusée). SQL idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PettyCashTopUpStatus') THEN
    CREATE TYPE "PettyCashTopUpStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PettyCashPlan" (
  "id"                 TEXT PRIMARY KEY,
  "departmentId"       TEXT NOT NULL,
  "monthlyAmount"      DECIMAL(14,2) NOT NULL DEFAULT 0,
  "rechargeDay"        INTEGER NOT NULL DEFAULT 1,
  "holderId"           TEXT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "lastReminderPeriod" TEXT,
  "setById"            TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PettyCashPlan_departmentId_key" ON "PettyCashPlan" ("departmentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashPlan_departmentId_fkey') THEN
    ALTER TABLE "PettyCashPlan" ADD CONSTRAINT "PettyCashPlan_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashPlan_holderId_fkey') THEN
    ALTER TABLE "PettyCashPlan" ADD CONSTRAINT "PettyCashPlan_holderId_fkey"
      FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashPlan_setById_fkey') THEN
    ALTER TABLE "PettyCashPlan" ADD CONSTRAINT "PettyCashPlan_setById_fkey"
      FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PettyCashTopUpRequest" (
  "id"              TEXT PRIMARY KEY,
  "allotmentId"     TEXT NOT NULL,
  "amountRequested" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "reason"          TEXT,
  "status"          "PettyCashTopUpStatus" NOT NULL DEFAULT 'PENDING',
  "amountGranted"   DECIMAL(14,2),
  "requestedById"   TEXT,
  "decidedById"     TEXT,
  "decidedAt"       TIMESTAMP(3),
  "decisionNote"    TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PettyCashTopUpRequest_allotmentId_idx" ON "PettyCashTopUpRequest" ("allotmentId");
CREATE INDEX IF NOT EXISTS "PettyCashTopUpRequest_status_idx" ON "PettyCashTopUpRequest" ("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashTopUpRequest_allotmentId_fkey') THEN
    ALTER TABLE "PettyCashTopUpRequest" ADD CONSTRAINT "PettyCashTopUpRequest_allotmentId_fkey"
      FOREIGN KEY ("allotmentId") REFERENCES "PettyCashAllotment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashTopUpRequest_requestedById_fkey') THEN
    ALTER TABLE "PettyCashTopUpRequest" ADD CONSTRAINT "PettyCashTopUpRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashTopUpRequest_decidedById_fkey') THEN
    ALTER TABLE "PettyCashTopUpRequest" ADD CONSTRAINT "PettyCashTopUpRequest_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
