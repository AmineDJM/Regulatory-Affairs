-- BUDGET MARKETING (Direction, 08/10) : les enveloppes tenues par la Direction Marketing.
--
-- Une enveloppe marketing est une ligne BudgetEnvelope ordinaire marquee domaine = 'MARKETING' : Budgets la lit et
-- l'additionne comme avant, Budget Marketing ne lit qu'elles. Rien n'est recopie.
--
-- A la bascule, sont marquees MARKETING les enveloppes qui ne couvrent QUE la famille Ad & Pro (au moins un module,
-- aucun autre ; a defaut de modules, le module principal) - la regle de `domaineParDefaut`
-- (src/lib/budget-marketing/domaine.ts). Une enveloppe mixte reste generale.
--
-- Idempotente : le marquage n'a lieu qu'a la creation de la colonne (une enveloppe rendue generale ensuite ne sera
-- jamais re-marquee) ; colonnes et index ne sont crees que s'ils n'existent pas.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'BudgetEnvelope' AND column_name = 'domaine'
  ) THEN
    ALTER TABLE "BudgetEnvelope" ADD COLUMN "domaine" TEXT NOT NULL DEFAULT 'GENERAL';

    UPDATE "BudgetEnvelope" e
       SET "domaine" = 'MARKETING'
     WHERE (
             cardinality(e."modules") > 0
             AND e."modules" <@ ARRAY['SPONSORING','EVENTS','CONGRESS_NATIONAL','CONGRESS_INTERNATIONAL','PROMO_MATERIAL','AD_PRO_OTHER']::TEXT[]
           )
        OR (
             cardinality(e."modules") = 0
             AND e."module" IN ('SPONSORING','EVENTS','CONGRESS_NATIONAL','CONGRESS_INTERNATIONAL','PROMO_MATERIAL','AD_PRO_OTHER')
           );
  END IF;
END $$;

-- Rattachement facultatif d'une enveloppe a une Business Unit ou a un produit (ids, sans contrainte : une BU ou un
-- produit retire ne doit pas emporter l'enveloppe ni son historique).
ALTER TABLE "BudgetEnvelope" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
ALTER TABLE "BudgetEnvelope" ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "BudgetEnvelope_domaine_idx" ON "BudgetEnvelope"("domaine");
