-- Enveloppe budgétaire : plusieurs modules possibles
ALTER TABLE "BudgetEnvelope" ADD COLUMN "modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Reprise des enveloppes existantes : le module unique devient le premier élément.
UPDATE "BudgetEnvelope" SET "modules" = ARRAY["module"] WHERE "module" IS NOT NULL AND "module" <> '';
