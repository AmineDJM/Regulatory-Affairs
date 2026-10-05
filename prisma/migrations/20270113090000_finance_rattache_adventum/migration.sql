-- Finances › Banque & paiements : plus de vue « Toutes les entités » (Direction, 06/10).
-- Tout ce qui existait SANS entité est rattaché à Adventum.
--
-- Ce que la migration fait, et ne fait pas :
--   • elle ne touche QUE les lignes dont `companyId` est NULL — une ligne déjà rattachée à une autre
--     entité (Pharmagène…) garde la sienne : on ne réécrit pas l'historique d'une autre société ;
--   • elle ne supprime et ne crée aucune ligne ; seul `companyId` change (et `updatedAt` n'est pas
--     touché : le rattachement n'est pas une modification métier) ;
--   • Adventum est cherchée par identifiant (`company_adventum`), à défaut par nom. Sans entité
--     Adventum, RIEN n'est modifié (le bloc ne fait rien) plutôt que de deviner une autre société ;
--   • IDEMPOTENTE : rejouée, elle ne trouve plus de ligne à rattacher.
--
-- Tables : les ordres de dépense (la file « À régler »), les comptes de trésorerie (la banque) et
-- les écritures de trésorerie (le livre).

DO $$
DECLARE
  adventum text;
BEGIN
  SELECT c.id INTO adventum
  FROM "Company" c
  WHERE c.id = 'company_adventum'
     OR c.name ILIKE '%adventum%'
  ORDER BY (c.id = 'company_adventum') DESC, c."sortOrder", c."createdAt"
  LIMIT 1;

  IF adventum IS NULL THEN
    RAISE NOTICE 'Aucune entité Adventum : aucun rattachement effectué.';
    RETURN;
  END IF;

  UPDATE "ExpenseOrder"        SET "companyId" = adventum WHERE "companyId" IS NULL;
  UPDATE "TreasuryAccount"     SET "companyId" = adventum WHERE "companyId" IS NULL;
  UPDATE "FinanceTransaction"  SET "companyId" = adventum WHERE "companyId" IS NULL;
END $$;
