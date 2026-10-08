-- BUDGET REGULATORY et BUDGET OPERATIONS & SALES (Direction, 08/10) : apres le Budget Marketing, deux autres poles
-- tiennent leurs enveloppes. Une enveloppe de pole reste une ligne BudgetEnvelope ordinaire, marquee par son domaine
-- ('REGULATORY', 'OPERATIONS') : Budgets la lit et l'additionne comme avant, le module du pole ne lit qu'elles.
--
-- Nouveaux champs :
--   * BudgetCategoryLine.cle            : la cle stable d'une categorie reconnue par le code ('BV_25', 'BV_75',
--                                          'MASSE_SALARIALE_FDV') ; nulle pour une categorie libre ;
--   * BudgetCategoryLine.businessUnitId : la BU d'une sous-categorie de masse salariale (id sans contrainte) ;
--   * BudgetExpenseLine.regulatoryProductId : le dossier d'enregistrement d'un BV saisi a la main.
--
-- A la bascule, sont marquees REGULATORY les enveloppes GENERALES qui ne couvrent QUE le module Regulatory (au moins
-- un module, aucun autre ; a defaut de modules, le module principal) - la regle de `domaineRegulatoryParDefaut`
-- (src/lib/budget/domaines.ts). Une enveloppe mixte reste generale ; une enveloppe deja d'un pole ne bouge pas.
-- Rien n'est devine pour les Operations : 'LOGISTICS' ou 'PCH' ne disent pas, a eux seuls, qui tient l'enveloppe.
--
-- Idempotente : le marquage n'a lieu qu'a la creation de la colonne `cle` (une enveloppe rendue generale ensuite ne
-- sera jamais re-marquee) ; colonnes et index ne sont crees que s'ils n'existent pas.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BudgetCategoryLine' AND column_name = 'cle'
  ) THEN
    ALTER TABLE "BudgetCategoryLine" ADD COLUMN "cle" TEXT;

    UPDATE "BudgetEnvelope" e
       SET "domaine" = 'REGULATORY'
     WHERE e."domaine" = 'GENERAL'
       AND (
             (
               cardinality(e."modules") > 0
               AND e."modules" <@ ARRAY['REGULATORY']::TEXT[]
             )
          OR (
               cardinality(e."modules") = 0
               AND e."module" IN ('REGULATORY')
             )
           );
  END IF;
END $$;

ALTER TABLE "BudgetCategoryLine" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
ALTER TABLE "BudgetExpenseLine" ADD COLUMN IF NOT EXISTS "regulatoryProductId" TEXT;

CREATE INDEX IF NOT EXISTS "BudgetCategoryLine_cle_idx" ON "BudgetCategoryLine"("cle");
CREATE INDEX IF NOT EXISTS "BudgetExpenseLine_regulatoryProductId_idx" ON "BudgetExpenseLine"("regulatoryProductId");
