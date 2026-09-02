-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- RATTACHER LES ORDRES DE DÉPENSE ORPHELINS À LEUR ENTITÉ.
--
-- `companyOfExpense` ne connaissait que quatre sources — sponsoring, les deux congrès, matériel
-- promo — et PAS `PAYMENT_REQUEST`, devenue la plus fréquente depuis que le centre de paiement est
-- le guichet unique. Tous ces ordres sont nés avec `companyId = NULL` dès que le demandeur n'avait
-- pas de fiche salarié rattachée.
--
-- Ce n'était pas qu'un défaut de classement : le filtre d'entité vaut `companyId = X`, et NULL
-- n'est pas X. Ces ordres étaient donc INVISIBLES à quiconque est cloisonné sur une société — le
-- Super Admin (vue groupe) voyait la file entière, le Directeur Général ouvrait un écran vide.
--
-- Le code est corrigé pour les ordres à VENIR (table de sources exhaustive) et les écrans gardent
-- désormais les orphelins visibles (`companyScopedWhere`). Cette migration répare le PASSÉ : elle
-- relit la source de chaque ordre non rattaché et lui rend son entité.
--
-- ON NE DEVINE RIEN. Un ordre dont la source n'a pas d'entité, ou dont la source a disparu, reste
-- à NULL : il est désormais visible de tous et se rattachera à la main. Inventer une société pour
-- faire propre imputerait une dépense à la mauvaise comptabilité.
--
-- Idempotent : ne touche que les lignes encore à NULL, rejouable sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "PaymentRequest" s
WHERE o."companyId" IS NULL AND o."sourceType" = 'PAYMENT_REQUEST'
  AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "AdministrativeRequest" s
WHERE o."companyId" IS NULL AND o."sourceType" = 'ADMIN_REQUEST'
  AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "MedicalInfoDeclaration" s
WHERE o."companyId" IS NULL AND o."sourceType" = 'MEDICAL_INFO_DECLARATION'
  AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "LegalDocument" s
WHERE o."companyId" IS NULL AND o."sourceType" = 'LEGAL_DOCUMENT'
  AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "ConsultingContract" s
WHERE o."companyId" IS NULL AND o."sourceType" = 'CONSULTING_CONTRACT'
  AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "Event" s
WHERE o."companyId" IS NULL AND o."sourceType" = 'EVENT'
  AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

UPDATE "ExpenseOrder" o SET "companyId" = s."companyId"
FROM "RegulatoryProduct" s
WHERE o."companyId" IS NULL AND o."sourceType" = 'REGULATORY_PRODUCT'
  AND o."sourceId" = s."id" AND s."companyId" IS NOT NULL;

-- Dernier recours : la société de la fiche salarié du DEMANDEUR — le même repli que le code.
UPDATE "ExpenseOrder" o SET "companyId" = e."companyId"
FROM "Employee" e
WHERE o."companyId" IS NULL AND o."requestedById" IS NOT NULL
  AND e."userId" = o."requestedById" AND e."companyId" IS NOT NULL;
