-- LE DÉTAIL D'UN TICKET DE CAISSE : une pièce justificative porte presque toujours plusieurs
-- articles. Jusqu'ici une dépense n'était qu'un libellé et un montant — on savait ce qui était
-- sorti de la caisse, jamais ce qui avait été acheté.
--
-- `label` est figé à l'achat EN PLUS du lien vers le catalogue : un article renommé ou retiré
-- ne doit pas réécrire un ticket déjà classé. `articleId` peut être NULL — un achat hors
-- catalogue reste un achat.
CREATE TABLE IF NOT EXISTS "DepartmentExpenseLine" (
  "id"        TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "articleId" TEXT,
  "label"     TEXT NOT NULL,
  "quantity"  DECIMAL(12,3) NOT NULL DEFAULT 1,
  "amount"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentExpenseLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DepartmentExpenseLine_expenseId_idx" ON "DepartmentExpenseLine" ("expenseId");
CREATE INDEX IF NOT EXISTS "DepartmentExpenseLine_articleId_idx" ON "DepartmentExpenseLine" ("articleId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentExpenseLine_expenseId_fkey') THEN
    ALTER TABLE "DepartmentExpenseLine"
      ADD CONSTRAINT "DepartmentExpenseLine_expenseId_fkey"
      FOREIGN KEY ("expenseId") REFERENCES "DepartmentBudgetExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentExpenseLine_articleId_fkey') THEN
    ALTER TABLE "DepartmentExpenseLine"
      ADD CONSTRAINT "DepartmentExpenseLine_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "OfficeSupplyArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
