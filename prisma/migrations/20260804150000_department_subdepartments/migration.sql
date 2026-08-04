-- Sous-départements : hiérarchie de départements (parent → enfants). Idempotent.
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Department_parentId_idx" ON "Department"("parentId");
