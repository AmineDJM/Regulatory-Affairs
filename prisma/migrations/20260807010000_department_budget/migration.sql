-- BUDGET PAR DÉPARTEMENT — deux natures, deux responsables.
--
--   • OPERATING : le fonctionnement (hors employés), réglé par l'ADMINISTRATEUR ;
--   • HR        : les employés et le recrutement, réglés par les RESSOURCES HUMAINES.
--
-- La séparation tient dans la clé unique (département, année, nature) : les deux
-- responsables n'écrivent jamais la même ligne, donc l'un ne peut pas écraser l'autre.
-- Le contrôle des droits reste applicatif — la contrainte, elle, rend l'écrasement
-- structurellement impossible.
--
-- Idempotent : type, table, contraintes et index sont tous conditionnels.

DO $$
BEGIN
  CREATE TYPE "DepartmentBudgetKind" AS ENUM ('OPERATING', 'HR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DepartmentBudget" (
  "id"           TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "year"         INTEGER NOT NULL,
  "kind"         "DepartmentBudgetKind" NOT NULL,
  "amount"       DECIMAL(14,2) NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "setById"      TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentBudget_pkey" PRIMARY KEY ("id")
);

-- Un département supprimé emporte ses budgets (ils n'ont plus d'objet) ; un compte
-- supprimé laisse la ligne en place, sans auteur — perdre le montant parce que la
-- personne qui l'a saisi est partie n'aurait aucun sens.
DO $$
BEGIN
  ALTER TABLE "DepartmentBudget"
    ADD CONSTRAINT "DepartmentBudget_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "DepartmentBudget"
    ADD CONSTRAINT "DepartmentBudget_setById_fkey"
    FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentBudget_departmentId_year_kind_key"
  ON "DepartmentBudget" ("departmentId", "year", "kind");
CREATE INDEX IF NOT EXISTS "DepartmentBudget_year_kind_idx"
  ON "DepartmentBudget" ("year", "kind");
