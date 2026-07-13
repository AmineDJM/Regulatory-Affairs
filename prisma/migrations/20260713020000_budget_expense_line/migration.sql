-- Ligne de dépense purement budgétaire (découplée des Finances / de la trésorerie).
-- Elle CONSOMME une (sous-)catégorie sans créer de mouvement de trésorerie.

CREATE TABLE IF NOT EXISTS "BudgetExpenseLine" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetExpenseLine_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "BudgetExpenseLine"
        ADD CONSTRAINT "BudgetExpenseLine_categoryId_fkey"
        FOREIGN KEY ("categoryId") REFERENCES "BudgetCategoryLine"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "BudgetExpenseLine_categoryId_idx" ON "BudgetExpenseLine"("categoryId");
CREATE INDEX IF NOT EXISTS "BudgetExpenseLine_date_idx" ON "BudgetExpenseLine"("date");

-- Reprise : les anciennes lignes « ajout rapide depuis le Budget » avaient été créées comme
-- des FinanceTransaction (donc prélevées de la trésorerie). On les convertit en lignes purement
-- budgétaires puis on les retire des Finances — conformément au nouveau modèle découplé.
INSERT INTO "BudgetExpenseLine" ("id", "categoryId", "reference", "amount", "date", "createdById", "createdAt")
SELECT "id", "budgetCategoryId", "label", "amount", "date", "createdById", "createdAt"
FROM "FinanceTransaction"
WHERE "notes" = 'Ligne de dépense saisie depuis le module Budget.' AND "budgetCategoryId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "FinanceTransaction"
WHERE "notes" = 'Ligne de dépense saisie depuis le module Budget.' AND "budgetCategoryId" IS NOT NULL;
