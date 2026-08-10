-- FORMATIONS : demandes individuelles (circuit N+1 → RH → DG), formations organisées par les
-- RH avec participants (obligatoires ou volontaires), postes validés un par un, budget dédié.
-- SQL idempotent : rejouable sans dommage.

-- 1. Budget FORMATION, 4e nature de budget départemental ------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DepartmentBudgetKind' AND e.enumlabel = 'TRAINING'
  ) THEN
    ALTER TYPE "DepartmentBudgetKind" ADD VALUE 'TRAINING';
  END IF;
END $$;

-- 2. Énumérations propres à la formation -----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingOrigin') THEN
    CREATE TYPE "TrainingOrigin" AS ENUM ('EMPLOYEE', 'HR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingStatus') THEN
    CREATE TYPE "TrainingStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'DONE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingAttendance') THEN
    CREATE TYPE "TrainingAttendance" AS ENUM ('MANDATORY', 'VOLUNTARY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingParticipantState') THEN
    CREATE TYPE "TrainingParticipantState" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED');
  END IF;
END $$;

-- 3. La formation ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Training" (
  "id"                 TEXT PRIMARY KEY,
  "companyId"          TEXT,
  "reference"          TEXT NOT NULL,
  "title"              TEXT NOT NULL,
  "origin"             "TrainingOrigin" NOT NULL DEFAULT 'EMPLOYEE',
  "status"             "TrainingStatus" NOT NULL DEFAULT 'PENDING',
  "provider"           TEXT,
  "description"        TEXT,
  "startDate"          TIMESTAMP(3),
  "endDate"            TIMESTAMP(3),
  "location"           TEXT,
  "amount"             DECIMAL(14,2) NOT NULL DEFAULT 0,
  "amountGranted"      DECIMAL(14,2),
  "requesterId"        TEXT,
  "departmentId"       TEXT,
  "stage"              "LeaveStage" NOT NULL DEFAULT 'MANAGER',
  "managerId"          TEXT,
  "managerDecidedById" TEXT,
  "managerDecidedAt"   TIMESTAMP(3),
  "managerNote"        TEXT,
  "hrDecidedById"      TEXT,
  "hrDecidedAt"        TIMESTAMP(3),
  "hrNote"             TEXT,
  "dgDecidedById"      TEXT,
  "dgDecidedAt"        TIMESTAMP(3),
  "dgNote"             TEXT,
  "createdById"        TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Training_reference_key" ON "Training" ("reference");
CREATE INDEX IF NOT EXISTS "Training_status_idx" ON "Training" ("status");
CREATE INDEX IF NOT EXISTS "Training_requesterId_idx" ON "Training" ("requesterId");
CREATE INDEX IF NOT EXISTS "Training_departmentId_idx" ON "Training" ("departmentId");
CREATE INDEX IF NOT EXISTS "Training_companyId_idx" ON "Training" ("companyId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Training_companyId_fkey') THEN
    ALTER TABLE "Training" ADD CONSTRAINT "Training_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Training_requesterId_fkey') THEN
    ALTER TABLE "Training" ADD CONSTRAINT "Training_requesterId_fkey"
      FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Training_departmentId_fkey') THEN
    ALTER TABLE "Training" ADD CONSTRAINT "Training_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Participants ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TrainingParticipant" (
  "id"          TEXT PRIMARY KEY,
  "trainingId"  TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "attendance"  "TrainingAttendance" NOT NULL DEFAULT 'VOLUNTARY',
  "state"       "TrainingParticipantState" NOT NULL DEFAULT 'INVITED',
  "respondedAt" TIMESTAMP(3),
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingParticipant_trainingId_userId_key" ON "TrainingParticipant" ("trainingId", "userId");
CREATE INDEX IF NOT EXISTS "TrainingParticipant_userId_state_idx" ON "TrainingParticipant" ("userId", "state");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingParticipant_trainingId_fkey') THEN
    ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_trainingId_fkey"
      FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TrainingParticipant_userId_fkey') THEN
    ALTER TABLE "TrainingParticipant" ADD CONSTRAINT "TrainingParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Une formation porte des POSTES, comme un sponsoring ---------------------------------------
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "trainingId" TEXT;
CREATE INDEX IF NOT EXISTS "AdProItem_trainingId_idx" ON "AdProItem" ("trainingId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdProItem_trainingId_fkey') THEN
    ALTER TABLE "AdProItem" ADD CONSTRAINT "AdProItem_trainingId_fkey"
      FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Un poste appartient à UNE opération et une seule — la contrainte compte désormais 5 parents.
ALTER TABLE "AdProItem" DROP CONSTRAINT IF EXISTS "AdProItem_one_parent";
ALTER TABLE "AdProItem"
  ADD CONSTRAINT "AdProItem_one_parent"
  CHECK (
    (CASE WHEN "sponsoringId" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "congressNationalId" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "congressInternationalId" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "eventId" IS NULL THEN 0 ELSE 1 END)
  + (CASE WHEN "trainingId" IS NULL THEN 0 ELSE 1 END)
  = 1
  );
