-- Budgets :
--  1) Accès par UTILISATEUR à une enveloppe (en plus des rôles), autorisé par le Super Admin.
--  2) Sous-catégories : une catégorie peut être rattachée à une catégorie parente
--     (ex. « Table ronde » sous « Événement »), créées à la main.

ALTER TABLE "BudgetEnvelope"
  ADD COLUMN IF NOT EXISTS "accessUserIds" TEXT[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE "BudgetCategoryLine"
  ADD COLUMN IF NOT EXISTS "parentId" TEXT;

CREATE INDEX IF NOT EXISTS "BudgetCategoryLine_parentId_idx" ON "BudgetCategoryLine"("parentId");

DO $$ BEGIN
  ALTER TABLE "BudgetCategoryLine"
    ADD CONSTRAINT "BudgetCategoryLine_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "BudgetCategoryLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
