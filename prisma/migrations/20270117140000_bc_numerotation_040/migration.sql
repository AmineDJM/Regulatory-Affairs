-- NUMÉROTATION DES BONS DE COMMANDE : « Commence par 040, pas 037. Fais-le pour Adventum, Pharmagene et AMD (3 entités). » (Direction, 10/2026).
--
-- Pour les trois sociétés (Adventum Pharma, Pharmagene, AMD), mettre le départ BC à 040/DG/2026 : la migration 20270117130500
-- avait fixé 037 pour TOUTES les sociétés au motif /DG/. Celle-ci cible les trois entités nommées, met leur plancher à 40,
-- et le compteur à 39, pour que le prochain numéro attribué soit 040 (max(dernier + 1, plancher) = max(38 + 1, 40)).
--
-- Idempotent : un départ 040 ou plus haut reste inchangé. Un compteur déjà à 39 ou plus n'est pas baissé.

-- 1. METTRE À JOUR LES PROFILS DES TROIS SOCIÉTÉS : plancher = 40 pour BON_DE_COMMANDE, 2026
UPDATE "CompanyDocumentProfile" p
SET "settings" = jsonb_set(
      COALESCE(p."settings", '{}'::jsonb),
      '{numerotationDepart}',
      COALESCE(p."settings"->'numerotationDepart', '{}'::jsonb)
        || jsonb_build_object(
             'BON_DE_COMMANDE',
             COALESCE(p."settings"->'numerotationDepart'->'BON_DE_COMMANDE', '{}'::jsonb) || jsonb_build_object('2026', 40)
           ),
      true
    ),
    "updatedAt" = now()
FROM "Company" c
WHERE p."companyId" = c."id"
  AND p."settings" IS NOT NULL
  AND jsonb_typeof(p."settings") = 'object'
  -- Cible les trois sociétés (LIKE insensible à la casse, sans accent)
  AND (
    c."name" ILIKE '%adventum%' OR c."shortName" ILIKE '%adventum%'
    OR c."name" ILIKE '%pharmagene%' OR c."shortName" ILIKE '%pharmagene%'
    OR c."name" ILIKE '%amd%' OR c."shortName" ILIKE '%amd%'
  )
  -- Seulement celles dont le motif porte /DG/
  AND (p."settings"->'numerotation'->>'BON_DE_COMMANDE') ILIKE '%/DG/%'
  -- Ne pas baisser un départ déjà réglé à 40 ou plus
  AND (
    (p."settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026') IS NULL
    OR (CASE WHEN (p."settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026') ~ '^[0-9]+$'
             THEN (p."settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026')::numeric < 40
             ELSE false END)
  );

-- 2. CRÉER OU METTRE À JOUR LE COMPTEUR DE 2026 : plancher = 39 (prochain = 40)
INSERT INTO "DocumentSequence" ("id", "companyId", "kind", "year", "last", "updatedAt")
SELECT 'bcnum' || md5(c."id" || clock_timestamp()::text || random()::text), c."id", 'PURCHASE_ORDER', 2026, 39, now()
FROM "Company" c
INNER JOIN "CompanyDocumentProfile" p ON p."companyId" = c."id"
WHERE p."settings" IS NOT NULL
  AND jsonb_typeof(p."settings") = 'object'
  AND (p."settings"->'numerotation'->>'BON_DE_COMMANDE') ILIKE '%/DG/%'
  AND (
    c."name" ILIKE '%adventum%' OR c."shortName" ILIKE '%adventum%'
    OR c."name" ILIKE '%pharmagene%' OR c."shortName" ILIKE '%pharmagene%'
    OR c."name" ILIKE '%amd%' OR c."shortName" ILIKE '%amd%'
  )
ON CONFLICT ("companyId", "kind", "year")
DO UPDATE SET "last" = GREATEST("DocumentSequence"."last", 39), "updatedAt" = now();
