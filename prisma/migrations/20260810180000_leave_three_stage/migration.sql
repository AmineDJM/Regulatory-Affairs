-- Congés : circuit à TROIS marches (N+1 → RH → DG). Idempotent.
DO $$ BEGIN
    CREATE TYPE "LeaveStage" AS ENUM ('MANAGER', 'HR', 'DG', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "stage" "LeaveStage" NOT NULL DEFAULT 'MANAGER';
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerId" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerDecidedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerDecidedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerNote" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrDecidedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrDecidedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrNote" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "dgDecidedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "dgDecidedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "dgNote" TEXT;

-- EXISTANT : une demande déjà tranchée a fini son circuit ; une demande en attente créée AVANT
-- ce circuit n'a pas de responsable résolu — on la place à l'étape RH pour ne bloquer personne.
UPDATE "LeaveRequest" SET "stage" = 'DONE' WHERE "status" <> 'PENDING' AND "stage" = 'MANAGER';
UPDATE "LeaveRequest" SET "stage" = 'HR' WHERE "status" = 'PENDING' AND "stage" = 'MANAGER' AND "createdAt" < NOW();

CREATE INDEX IF NOT EXISTS "LeaveRequest_stage_idx" ON "LeaveRequest"("stage");
