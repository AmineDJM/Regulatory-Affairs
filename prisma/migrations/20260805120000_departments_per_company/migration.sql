-- Chaque ENTITÉ (Adventum, Pharmagène…) a SES propres départements.
-- Le nom devient unique PAR ENTITÉ (deux sociétés peuvent avoir un « Commercial »).
-- Idempotent — sûr à rejouer.

ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Department_companyId_idx" ON "Department"("companyId");

-- Reprise : un département existant est rattaché à l'entité de ses membres, quand elle est
-- unanime (aucune ambiguïté). Sinon il reste transverse (companyId NULL) et le DRH tranchera.
UPDATE "Department" d
SET "companyId" = sub."companyId"
FROM (
  SELECT e."departmentId" AS dept_id, MIN(e."companyId") AS "companyId"
  FROM "Employee" e
  WHERE e."departmentId" IS NOT NULL AND e."companyId" IS NOT NULL
  GROUP BY e."departmentId"
  HAVING COUNT(DISTINCT e."companyId") = 1
) sub
WHERE d."id" = sub.dept_id AND d."companyId" IS NULL;

-- Un sous-département hérite de l'entité de son parent (cohérence de l'arbre).
UPDATE "Department" child
SET "companyId" = parent."companyId"
FROM "Department" parent
WHERE child."parentId" = parent."id"
  AND child."companyId" IS NULL AND parent."companyId" IS NOT NULL;

-- Le nom n'est plus unique globalement, mais unique PAR ENTITÉ.
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Department_companyId_name_key" ON "Department"("companyId", "name");
