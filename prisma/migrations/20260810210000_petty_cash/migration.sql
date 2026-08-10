-- CAISSE D'AVANCE (trésorerie temporaire) : somme remise chaque mois à celle qui achète au
-- quotidien, confirmée « reçue », puis déduite dépense par dépense avec justificatif.
-- SQL idempotent : rejouable sans dommage.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PettyCashStatus') THEN
    CREATE TYPE "PettyCashStatus" AS ENUM ('ALLOTTED', 'RECEIVED', 'CLOSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PettyCashAllotment" (
  "id"           TEXT PRIMARY KEY,
  "departmentId" TEXT NOT NULL,
  "period"       TEXT NOT NULL,
  "amount"       DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status"       "PettyCashStatus" NOT NULL DEFAULT 'ALLOTTED',
  "holderId"     TEXT,
  "receivedAt"   TIMESTAMP(3),
  "note"         TEXT,
  "createdById"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PettyCashAllotment_departmentId_period_idx" ON "PettyCashAllotment" ("departmentId", "period");
CREATE INDEX IF NOT EXISTS "PettyCashAllotment_holderId_status_idx" ON "PettyCashAllotment" ("holderId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashAllotment_departmentId_fkey') THEN
    ALTER TABLE "PettyCashAllotment"
      ADD CONSTRAINT "PettyCashAllotment_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashAllotment_holderId_fkey') THEN
    ALTER TABLE "PettyCashAllotment"
      ADD CONSTRAINT "PettyCashAllotment_holderId_fkey"
      FOREIGN KEY ("holderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PettyCashAllotment_createdById_fkey') THEN
    ALTER TABLE "PettyCashAllotment"
      ADD CONSTRAINT "PettyCashAllotment_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Une dépense peut être PAYÉE sur la caisse (argent sorti du tiroir) ou non (virement).
ALTER TABLE "DepartmentBudgetExpense" ADD COLUMN IF NOT EXISTS "pettyCashId" TEXT;
CREATE INDEX IF NOT EXISTS "DepartmentBudgetExpense_pettyCashId_idx" ON "DepartmentBudgetExpense" ("pettyCashId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetExpense_pettyCashId_fkey') THEN
    ALTER TABLE "DepartmentBudgetExpense"
      ADD CONSTRAINT "DepartmentBudgetExpense_pettyCashId_fkey"
      FOREIGN KEY ("pettyCashId") REFERENCES "PettyCashAllotment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
