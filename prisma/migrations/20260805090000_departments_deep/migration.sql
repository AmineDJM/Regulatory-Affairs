-- ─────────────────────────────────────────────────────────────────────────────
-- Départements « en profondeur » : responsable/adjoint, rattachement structuré des
-- employés, et REPRISE DES DONNÉES EXISTANTES (le champ texte libre Employee.department
-- devient de vrais départements). Idempotent — sûr à rejouer.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Département : responsable, adjoint, description
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "headId" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "deputyId" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- 2. Employé : rattachement structuré (département OU sous-département)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

-- 3. Clés étrangères (SetNull : supprimer un département ne supprime jamais un employé)
DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey"
    FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Department" ADD CONSTRAINT "Department_deputyId_fkey"
    FOREIGN KEY ("deputyId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Department_headId_idx" ON "Department"("headId");
CREATE INDEX IF NOT EXISTS "Employee_departmentId_idx" ON "Employee"("departmentId");

-- 4. REPRISE DES DONNÉES : chaque libellé distinct de Employee.department qui n'existe
--    pas encore comme département est créé (code technique dérivé du nom, dédupliqué).
INSERT INTO "Department" ("id", "name", "code", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       d.name,
       d.code || CASE WHEN d.rn > 1 THEN '_' || d.rn::text ELSE '' END,
       now(), now()
FROM (
  SELECT src.name, src.code, row_number() OVER (PARTITION BY src.code ORDER BY src.name) AS rn
  FROM (
    SELECT DISTINCT
      btrim(e."department") AS name,
      left(upper(regexp_replace(
        translate(btrim(e."department"),
                  'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ',
                  'aaaeeeeiioouuucAAAEEEEIIOOUUUC'),
        '[^a-zA-Z0-9]+', '_', 'g')), 24) AS code
    FROM "Employee" e
    WHERE e."department" IS NOT NULL AND btrim(e."department") <> ''
  ) src
) d
WHERE NOT EXISTS (SELECT 1 FROM "Department" x WHERE x."name" = d.name)
  AND NOT EXISTS (SELECT 1 FROM "Department" y WHERE y."code" = d.code || CASE WHEN d.rn > 1 THEN '_' || d.rn::text ELSE '' END);

-- 5. Rattachement des employés au département correspondant à leur libellé.
UPDATE "Employee" e
SET "departmentId" = d."id"
FROM "Department" d
WHERE e."departmentId" IS NULL
  AND e."department" IS NOT NULL
  AND btrim(e."department") = d."name";

-- 6. Le compte applicatif hérite du département de sa fiche employé (permissions,
--    notifications et périmètres travaillent sur User).
UPDATE "User" u
SET "departmentId" = e."departmentId"
FROM "Employee" e
WHERE e."userId" = u."id" AND e."departmentId" IS NOT NULL AND u."departmentId" IS NULL;
