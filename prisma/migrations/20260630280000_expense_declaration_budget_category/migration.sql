-- La Direction choisit la (sous-)catégorie budgétaire à la validation définitive
-- d'une demande Ad & Pro. Le choix est porté par la déclaration d'information
-- médicale puis par l'ordre de dépense, et sert d'attribution à la FinanceTransaction.
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "budgetCategoryId" TEXT;
ALTER TABLE "MedicalInfoDeclaration" ADD COLUMN IF NOT EXISTS "budgetCategoryId" TEXT;
