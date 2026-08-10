-- Budgets par département : 3e nature (budget MÉTIER), dotations/rallonges soumises à
-- l'administration, et dépenses réellement imputées (avec justificatif).
-- SQL idempotent : rejouable sans dommage sur une base déjà migrée.

-- 1. Nature ACTIVITY (budget métier) ------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'DepartmentBudgetKind' AND e.enumlabel = 'ACTIVITY'
  ) THEN
    ALTER TYPE "DepartmentBudgetKind" ADD VALUE 'ACTIVITY';
  END IF;
END $$;

-- 2. Statut d'une demande de dotation / rallonge -------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeptBudgetRequestStatus') THEN
    CREATE TYPE "DeptBudgetRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- 3. Pièces justificatives d'une dépense départementale ------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EntityType' AND e.enumlabel = 'DEPARTMENT_EXPENSE'
  ) THEN
    ALTER TYPE "EntityType" ADD VALUE 'DEPARTMENT_EXPENSE';
  END IF;
END $$;

-- 4. Listes d'accès propres au budget MÉTIER ------------------------------------------------
ALTER TABLE "DepartmentBudgetAccess" ADD COLUMN IF NOT EXISTS "activityRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "DepartmentBudgetAccess" ADD COLUMN IF NOT EXISTS "activityUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 5. Demandes de dotation / rallonge ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "DepartmentBudgetRequest" (
  "id"            TEXT PRIMARY KEY,
  "departmentId"  TEXT NOT NULL,
  "year"          INTEGER NOT NULL,
  "kind"          "DepartmentBudgetKind" NOT NULL,
  "amount"        DECIMAL(14,2) NOT NULL DEFAULT 0,
  "reason"        TEXT,
  "status"        "DeptBudgetRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById"   TEXT,
  "decidedAt"     TIMESTAMP(3),
  "decisionNote"  TEXT
);
CREATE INDEX IF NOT EXISTS "DepartmentBudgetRequest_departmentId_year_idx" ON "DepartmentBudgetRequest" ("departmentId", "year");
CREATE INDEX IF NOT EXISTS "DepartmentBudgetRequest_status_idx" ON "DepartmentBudgetRequest" ("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetRequest_departmentId_fkey') THEN
    ALTER TABLE "DepartmentBudgetRequest"
      ADD CONSTRAINT "DepartmentBudgetRequest_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetRequest_requestedById_fkey') THEN
    ALTER TABLE "DepartmentBudgetRequest"
      ADD CONSTRAINT "DepartmentBudgetRequest_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetRequest_decidedById_fkey') THEN
    ALTER TABLE "DepartmentBudgetRequest"
      ADD CONSTRAINT "DepartmentBudgetRequest_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Dépenses imputées à un budget départemental ---------------------------------------------
CREATE TABLE IF NOT EXISTS "DepartmentBudgetExpense" (
  "id"             TEXT PRIMARY KEY,
  "departmentId"   TEXT NOT NULL,
  "year"           INTEGER NOT NULL,
  "kind"           "DepartmentBudgetKind" NOT NULL DEFAULT 'OPERATING',
  "label"          TEXT NOT NULL,
  "amount"         DECIMAL(14,2) NOT NULL DEFAULT 0,
  "date"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"          TEXT,
  "adminRequestId" TEXT,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DepartmentBudgetExpense_departmentId_year_kind_idx" ON "DepartmentBudgetExpense" ("departmentId", "year", "kind");
CREATE INDEX IF NOT EXISTS "DepartmentBudgetExpense_adminRequestId_idx" ON "DepartmentBudgetExpense" ("adminRequestId");
CREATE INDEX IF NOT EXISTS "DepartmentBudgetExpense_date_idx" ON "DepartmentBudgetExpense" ("date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetExpense_departmentId_fkey') THEN
    ALTER TABLE "DepartmentBudgetExpense"
      ADD CONSTRAINT "DepartmentBudgetExpense_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetExpense_adminRequestId_fkey') THEN
    ALTER TABLE "DepartmentBudgetExpense"
      ADD CONSTRAINT "DepartmentBudgetExpense_adminRequestId_fkey"
      FOREIGN KEY ("adminRequestId") REFERENCES "AdministrativeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetExpense_createdById_fkey') THEN
    ALTER TABLE "DepartmentBudgetExpense"
      ADD CONSTRAINT "DepartmentBudgetExpense_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
