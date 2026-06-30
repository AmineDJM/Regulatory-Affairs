-- Catégorie budgétaire rattachée à un module (attribution automatique des dépenses)
ALTER TABLE "BudgetCategoryLine" ADD COLUMN "module" TEXT;
CREATE INDEX "BudgetCategoryLine_module_idx" ON "BudgetCategoryLine"("module");
