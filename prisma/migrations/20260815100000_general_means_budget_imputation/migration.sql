-- MOYENS GÉNÉRAUX → BUDGET : chaque ticket, et chaque article d'un ticket, peut désigner sa
-- case budgétaire. C'est ce rattachement qui fait apparaître les achats du quotidien dans
-- l'enveloppe « Moyens généraux » sans donner au personnel qui achète l'accès au module Budget.
-- Idempotent : rejouable sans effet de bord.

ALTER TABLE "DepartmentBudgetExpense" ADD COLUMN IF NOT EXISTS "budgetCategoryId" TEXT;
ALTER TABLE "DepartmentExpenseLine"   ADD COLUMN IF NOT EXISTS "budgetCategoryId" TEXT;

CREATE INDEX IF NOT EXISTS "DepartmentBudgetExpense_budgetCategoryId_idx"
  ON "DepartmentBudgetExpense" ("budgetCategoryId");
CREATE INDEX IF NOT EXISTS "DepartmentExpenseLine_budgetCategoryId_idx"
  ON "DepartmentExpenseLine" ("budgetCategoryId");

-- Supprimer une catégorie ne doit JAMAIS effacer une dépense réelle : la dépense subsiste,
-- simplement « à classer ». L'inverse ferait disparaître des achats justifiés d'un budget.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentBudgetExpense_budgetCategoryId_fkey'
  ) THEN
    ALTER TABLE "DepartmentBudgetExpense"
      ADD CONSTRAINT "DepartmentBudgetExpense_budgetCategoryId_fkey"
      FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategoryLine"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentExpenseLine_budgetCategoryId_fkey'
  ) THEN
    ALTER TABLE "DepartmentExpenseLine"
      ADD CONSTRAINT "DepartmentExpenseLine_budgetCategoryId_fkey"
      FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategoryLine"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
