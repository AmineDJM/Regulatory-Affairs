-- RATTACHEMENT DE L'HISTORIQUE À SON ENTITÉ.
--
-- La règle devient stricte : choisir une entité ne montre QUE celle-là. Avant de la poser, il
-- faut que l'historique porte son entité — sinon des années de travail sortiraient des vues
-- d'un coup. On applique donc la règle métier elle-même, rétroactivement : ce que quelqu'un a
-- créé appartient à l'entité dont il est salarié.
--
-- L'ordre des sources compte : le CRÉATEUR d'abord (c'est lui qui a fait l'action), puis le
-- demandeur, puis l'assigné en dernier recours. On n'écrase JAMAIS un rattachement existant, et
-- ce qui reste sans entité reste sans entité : deviner à la place de l'utilisateur produirait
-- des rattachements faux, qui se découvrent bien plus tard qu'une case vide.
--
-- Idempotent : rejouable sans effet de bord (la clause `IS NULL` s'en charge).

-- AdministrativeRequest
UPDATE "AdministrativeRequest" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "AdministrativeRequest" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;
UPDATE "AdministrativeRequest" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."assignedToId" IS NOT NULL
    AND e."userId" = t."assignedToId" AND e."companyId" IS NOT NULL;

-- AnppReserveBatch
UPDATE "AnppReserveBatch" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- BudgetEnvelope
UPDATE "BudgetEnvelope" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- CongressInternational
UPDATE "CongressInternational" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "CongressInternational" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;

-- CongressNational
UPDATE "CongressNational" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "CongressNational" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;

-- Dossier
UPDATE "Dossier" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "Dossier" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."assignedToId" IS NOT NULL
    AND e."userId" = t."assignedToId" AND e."companyId" IS NOT NULL;

-- Event
UPDATE "Event" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "Event" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;

-- ExpenseOrder
UPDATE "ExpenseOrder" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requestedById" IS NOT NULL
    AND e."userId" = t."requestedById" AND e."companyId" IS NOT NULL;

-- FieldReport
UPDATE "FieldReport" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."delegateId" IS NOT NULL
    AND e."userId" = t."delegateId" AND e."companyId" IS NOT NULL;

-- FinanceTransaction
UPDATE "FinanceTransaction" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- LogisticsOrder
UPDATE "LogisticsOrder" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "LogisticsOrder" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."ownerId" IS NOT NULL
    AND e."userId" = t."ownerId" AND e."companyId" IS NOT NULL;

-- MedicalDoctor
UPDATE "MedicalDoctor" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "MedicalDoctor" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."delegateId" IS NOT NULL
    AND e."userId" = t."delegateId" AND e."companyId" IS NOT NULL;

-- MedicalInfoDeclaration
UPDATE "MedicalInfoDeclaration" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;

-- PchTender
UPDATE "PchTender" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- PromoMaterial
UPDATE "PromoMaterial" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "PromoMaterial" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;

-- PromoStockItem
UPDATE "PromoStockItem" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- RegulatoryAiBatch
UPDATE "RegulatoryAiBatch" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- RegulatoryDossier
UPDATE "RegulatoryDossier" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- RegulatoryProduct
UPDATE "RegulatoryProduct" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- RegulatoryUploadSession
UPDATE "RegulatoryUploadSession" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- Sale
UPDATE "Sale" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- SponsoringRequest
UPDATE "SponsoringRequest" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "SponsoringRequest" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;

-- StockSnapshot
UPDATE "StockSnapshot" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;

-- SupportRequest
UPDATE "SupportRequest" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;
UPDATE "SupportRequest" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."assignedToId" IS NOT NULL
    AND e."userId" = t."assignedToId" AND e."companyId" IS NOT NULL;

-- Training
UPDATE "Training" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."createdById" IS NOT NULL
    AND e."userId" = t."createdById" AND e."companyId" IS NOT NULL;
UPDATE "Training" t SET "companyId" = e."companyId"
  FROM "Employee" e
  WHERE t."companyId" IS NULL AND t."requesterId" IS NOT NULL
    AND e."userId" = t."requesterId" AND e."companyId" IS NOT NULL;

