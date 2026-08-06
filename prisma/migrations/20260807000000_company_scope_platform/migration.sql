-- CLOISONNEMENT PAR ENTITÉ SUR TOUTE LA PLATEFORME.
--
-- Jusqu'ici seuls Regulatory, les ventes, la logistique, la promotion médicale et les RH
-- portaient une entité. Le budget, l'Ad & Pro, les finances et les demandes n'en avaient
-- aucune : basculer le sélecteur sur « Pharmagène » laissait voir les demandes d'Adventum.
--
-- Trois choix assumés :
--
--   • la colonne est NULLABLE. Une demande sans entité reste visible en vue « Toutes les
--     entités » et peut être rattachée ensuite. Poser NOT NULL sur du stock existant
--     obligerait à deviner, et deviner sur un ordre de dépense se paie ;
--   • le rattachement rétroactif se déduit du DEMANDEUR (son entité d'appartenance RH), et
--     seulement quand elle est connue. Aucune règle de repli : mieux vaut une demande
--     visiblement non rattachée qu'une demande rattachée au hasard ;
--   • les RH ne reçoivent PAS de colonne. Congés, paie et avances pendent d'un employé, qui
--     porte déjà son entité : dupliquer l'information créerait deux vérités à désynchroniser.
--
-- Idempotent : colonnes, contraintes et index sont tous conditionnels.

-- ─────────────────────────── 1. Colonnes + clés étrangères + index ───────────────────────────

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'SponsoringRequest', 'CongressNational', 'CongressInternational', 'Event',
    'BudgetEnvelope', 'ExpenseOrder', 'AdministrativeRequest', 'SupportRequest',
    'Dossier', 'FieldReport'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "companyId" TEXT', t);

    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        t, t || '_companyId_fkey'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("companyId")', t || '_companyId_idx', t);
  END LOOP;
END $$;

-- ─────────────────────────── 2. Rattachement rétroactif ───────────────────────────
-- Depuis l'entité d'appartenance du demandeur. Chaque requête est bornée par
-- « companyId IS NULL » : rejouer la migration ne réécrit rien.

UPDATE "SponsoringRequest" r SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = r."requesterId" AND r."companyId" IS NULL AND e."companyId" IS NOT NULL;

UPDATE "CongressNational" r SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = r."requesterId" AND r."companyId" IS NULL AND e."companyId" IS NOT NULL;

UPDATE "CongressInternational" r SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = r."requesterId" AND r."companyId" IS NULL AND e."companyId" IS NOT NULL;

UPDATE "AdministrativeRequest" r SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = r."requesterId" AND r."companyId" IS NULL AND e."companyId" IS NOT NULL;

UPDATE "SupportRequest" r SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = r."requesterId" AND r."companyId" IS NULL AND e."companyId" IS NOT NULL;

UPDATE "Dossier" d SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = d."createdById" AND d."companyId" IS NULL AND e."companyId" IS NOT NULL;

UPDATE "FieldReport" f SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = f."delegateId" AND f."companyId" IS NULL AND e."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = e."companyId"
FROM "Employee" e WHERE e."userId" = o."requestedById" AND o."companyId" IS NULL AND e."companyId" IS NOT NULL;

-- Un ordre de dépense émis par un circuit Ad & Pro hérite de l'entité de SA demande — plus
-- fiable que le demandeur, qui peut avoir changé d'entité depuis.
UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "SponsoringRequest" s
WHERE o."sourceType" = 'SPONSORING' AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = c."companyId"
FROM "CongressNational" c
WHERE o."sourceType" = 'CONGRESS_NATIONAL' AND o."sourceId" = c."id" AND c."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = c."companyId"
FROM "CongressInternational" c
WHERE o."sourceType" = 'CONGRESS_INTERNATIONAL' AND o."sourceId" = c."id" AND c."companyId" IS NOT NULL;

-- Les événements et les enveloppes budgétaires n'ont pas de demandeur : s'il n'existe QU'UNE
-- entité active, il n'y a rien à deviner. Au-delà, on laisse non rattaché — l'administrateur
-- tranchera, et une enveloppe visiblement sans entité vaut mieux qu'une enveloppe attribuée
-- au hasard à la mauvaise société.
UPDATE "Event" SET "companyId" = (SELECT "id" FROM "Company" WHERE "isActive" = true)
WHERE "companyId" IS NULL AND (SELECT COUNT(*) FROM "Company" WHERE "isActive" = true) = 1;

UPDATE "BudgetEnvelope" SET "companyId" = (SELECT "id" FROM "Company" WHERE "isActive" = true)
WHERE "companyId" IS NULL AND (SELECT COUNT(*) FROM "Company" WHERE "isActive" = true) = 1;
