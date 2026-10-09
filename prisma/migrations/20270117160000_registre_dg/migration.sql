-- LE REGISTRE COMMUN DES RÉFÉRENCES NNN/DG/AAAA (Direction, 10/2026) :
--   « Tout document ou BC généré doit avoir la numérotation NNN/DG/AAAA » ;
--   « commence par 040, pas 037 ; fais-le pour Adventum, Pharmagene et AMD (3 entités) et permets de modifier les numéros de
--     référence à la génération » ; « un compteur commun pour les références ».
--
-- UN compteur par société et par année (`DocumentSequence`, kind `REGISTRE_DG`) pour TOUS les documents qui portent une
-- référence (bons de commande, ordres de mission, demandes de devis, pièces de la fabrique au motif /DG/), et UN registre
-- (`DocumentReference`) : une ligne par numéro attribué, unique par (société, année, numéro) tous types confondus, jamais
-- supprimée. La règle : src/lib/references/registre.ts.
--
-- Idempotente de bout en bout : rejouée, elle ne change plus rien ; aucun compteur ne recule ; aucun numéro déjà attribué ne
-- change. Les sociétés autres que les trois nommées gardent leur numérotation — sauf celles dont les BC portent déjà /DG/.

-- 1. LE REGISTRE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "DocumentReference" (
  "id"          TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "year"        INTEGER NOT NULL,
  "numero"      INTEGER NOT NULL,
  "reference"   TEXT NOT NULL,
  "docType"     TEXT NOT NULL,
  "entityType"  TEXT,
  "entityId"    TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentReference_companyId_year_numero_key" ON "DocumentReference" ("companyId", "year", "numero");
CREATE INDEX IF NOT EXISTS "DocumentReference_entityType_entityId_idx" ON "DocumentReference" ("entityType", "entityId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentReference_companyId_fkey') THEN
    ALTER TABLE "DocumentReference"
      ADD CONSTRAINT "DocumentReference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. LES TROIS SOCIÉTÉS TIENNENT LE REGISTRE ─────────────────────────────────────────────────────────────────────────────
-- Adventum Pharma, Pharmagène (avec ou sans accent), AMD (mot entier : « amd » au milieu d'un autre nom ne compte pas).

-- 2a. Un profil documentaire, s'il n'en existe pas (les réglages par défaut du code, plus le registre).
INSERT INTO "CompanyDocumentProfile" ("id", "companyId", "settings", "updatedAt")
SELECT 'regdg' || md5(c."id" || ':profil'), c."id", '{}'::jsonb, now()
FROM "Company" c
WHERE c."name" ILIKE '%adventum%' OR c."shortName" ILIKE '%adventum%'
   OR c."name" ILIKE '%pharmag_ne%' OR c."shortName" ILIKE '%pharmag_ne%'
   OR c."name" ~* '\mamd\M' OR c."shortName" ~* '\mamd\M'
ON CONFLICT ("companyId") DO NOTHING;

-- 2b. Le drapeau `registreDG` (la société tient le registre commun).
UPDATE "CompanyDocumentProfile" p
SET "settings" = COALESCE(p."settings", '{}'::jsonb) || jsonb_build_object('registreDG', true), "updatedAt" = now()
FROM "Company" c
WHERE p."companyId" = c."id"
  AND (p."settings" IS NULL OR jsonb_typeof(p."settings") = 'object')
  AND (
    c."name" ILIKE '%adventum%' OR c."shortName" ILIKE '%adventum%'
    OR c."name" ILIKE '%pharmag_ne%' OR c."shortName" ILIKE '%pharmag_ne%'
    OR c."name" ~* '\mamd\M' OR c."shortName" ~* '\mamd\M'
  )
  AND (p."settings"->'registreDG') IS DISTINCT FROM 'true'::jsonb;

-- 2c. Le motif des bons de commande à NNN/DG/AAAA, s'il ne porte pas déjà /DG/.
UPDATE "CompanyDocumentProfile" p
SET "settings" = jsonb_set(
      p."settings", '{numerotation}',
      (CASE WHEN jsonb_typeof(p."settings"->'numerotation') = 'object' THEN p."settings"->'numerotation' ELSE '{}'::jsonb END)
        || jsonb_build_object('BON_DE_COMMANDE', '{n:3}/DG/{aaaa}'),
      true),
    "updatedAt" = now()
FROM "Company" c
WHERE p."companyId" = c."id"
  AND jsonb_typeof(p."settings") = 'object'
  AND (
    c."name" ILIKE '%adventum%' OR c."shortName" ILIKE '%adventum%'
    OR c."name" ILIKE '%pharmag_ne%' OR c."shortName" ILIKE '%pharmag_ne%'
    OR c."name" ~* '\mamd\M' OR c."shortName" ~* '\mamd\M'
  )
  AND COALESCE(p."settings"->'numerotation'->>'BON_DE_COMMANDE', '') NOT ILIKE '%/DG/%';

-- 2d. Le départ 2026 à 040 (« commence par 040, pas 037 ») — jamais baissé s'il est déjà plus haut.
UPDATE "CompanyDocumentProfile" p
SET "settings" = jsonb_set(
      p."settings", '{numerotationDepart}',
      (CASE WHEN jsonb_typeof(p."settings"->'numerotationDepart') = 'object' THEN p."settings"->'numerotationDepart' ELSE '{}'::jsonb END)
        || jsonb_build_object(
             'BON_DE_COMMANDE',
             (CASE WHEN jsonb_typeof(p."settings"->'numerotationDepart'->'BON_DE_COMMANDE') = 'object'
                   THEN p."settings"->'numerotationDepart'->'BON_DE_COMMANDE' ELSE '{}'::jsonb END)
               || jsonb_build_object('2026', 40)
           ),
      true),
    "updatedAt" = now()
FROM "Company" c
WHERE p."companyId" = c."id"
  AND jsonb_typeof(p."settings") = 'object'
  AND (
    c."name" ILIKE '%adventum%' OR c."shortName" ILIKE '%adventum%'
    OR c."name" ILIKE '%pharmag_ne%' OR c."shortName" ILIKE '%pharmag_ne%'
    OR c."name" ~* '\mamd\M' OR c."shortName" ~* '\mamd\M'
  )
  AND NOT COALESCE(
    CASE WHEN (p."settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026') ~ '^[0-9]+$'
         THEN (p."settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026')::numeric >= 40 END,
    false);

-- 3. LES NUMÉROS DÉJÀ ATTRIBUÉS ENTRENT AU REGISTRE ───────────────────────────────────────────────────────────────────────
-- Toute pièce au registre Legal dont la référence est NNN/DG/AAAA (BC surtout ; annulée comprise : un numéro ne se réutilise
-- jamais). Deux pièces au même numéro : la plus ancienne l'inscrit.
WITH pieces AS (
  SELECT d."id", d."companyId", btrim(d."reference") AS ref, d."kind"::text AS kind, d."createdById", d."createdAt"
  FROM "LegalDocument" d
  WHERE d."companyId" IS NOT NULL
    AND d."reference" IS NOT NULL
    AND btrim(d."reference") ~* '^[0-9]{1,6}/DG/[0-9]{4}$'
), lues AS (
  SELECT p.*,
    CASE WHEN p.ref ~* '^[0-9]{1,6}/DG/[0-9]{4}$' THEN substring(p.ref FROM '^([0-9]+)/')::int END AS numero,
    CASE WHEN p.ref ~* '^[0-9]{1,6}/DG/[0-9]{4}$' THEN substring(p.ref FROM '([0-9]{4})$')::int END AS annee
  FROM pieces p
)
INSERT INTO "DocumentReference" ("id", "companyId", "year", "numero", "reference", "docType", "entityType", "entityId", "createdById", "createdAt")
SELECT 'regdg' || md5(l."id"), l."companyId", l.annee, l.numero, upper(l.ref),
  CASE l.kind WHEN 'PURCHASE_ORDER' THEN 'BON_DE_COMMANDE' WHEN 'QUOTE' THEN 'DEVIS' WHEN 'INVOICE' THEN 'FACTURE' WHEN 'CREDIT_NOTE' THEN 'AVOIR' ELSE 'BON_DE_COMMANDE' END,
  'LEGAL_DOCUMENT', l."id", l."createdById", l."createdAt"
FROM lues l
WHERE l.numero >= 1
ORDER BY l."createdAt", l."id"
ON CONFLICT DO NOTHING;

-- 4. LE COMPTEUR COMMUN ──────────────────────────────────────────────────────────────────────────────────────────────────
-- 4a. Il reprend les compteurs des séries qui l'alimentent (le BC d'une société au registre, toute nature au motif /DG/) :
--     le prochain numéro commun ne redescend sous aucun numéro déjà donné par ces séries.
INSERT INTO "DocumentSequence" ("id", "companyId", "kind", "year", "last", "updatedAt")
SELECT 'regdg' || md5(s."companyId" || ':' || s."year"::text || ':REGISTRE_DG'), s."companyId", 'REGISTRE_DG', s."year", max(s."last"), now()
FROM "DocumentSequence" s
JOIN "CompanyDocumentProfile" p ON p."companyId" = s."companyId"
WHERE jsonb_typeof(p."settings") = 'object'
  AND (
    (s."kind" = 'PURCHASE_ORDER' AND (p."settings"->'registreDG' = 'true'::jsonb OR COALESCE(p."settings"->'numerotation'->>'BON_DE_COMMANDE', '') ILIKE '%/DG/%'))
    OR (s."kind" = 'QUOTE' AND COALESCE(p."settings"->'numerotation'->>'DEVIS', '') ILIKE '%/DG/%')
    OR (s."kind" = 'INVOICE' AND COALESCE(p."settings"->'numerotation'->>'FACTURE', '') ILIKE '%/DG/%')
    OR (s."kind" = 'CREDIT_NOTE' AND COALESCE(p."settings"->'numerotation'->>'AVOIR', '') ILIKE '%/DG/%')
  )
GROUP BY s."companyId", s."year"
ON CONFLICT ("companyId", "kind", "year")
DO UPDATE SET "last" = GREATEST("DocumentSequence"."last", EXCLUDED."last"), "updatedAt" = now();

-- 4b. Et le plus haut numéro inscrit au registre, année par année.
INSERT INTO "DocumentSequence" ("id", "companyId", "kind", "year", "last", "updatedAt")
SELECT 'regdg' || md5(r."companyId" || ':' || r."year"::text || ':REGISTRE_DG'), r."companyId", 'REGISTRE_DG', r."year", max(r."numero"), now()
FROM "DocumentReference" r
GROUP BY r."companyId", r."year"
ON CONFLICT ("companyId", "kind", "year")
DO UPDATE SET "last" = GREATEST("DocumentSequence"."last", EXCLUDED."last"), "updatedAt" = now();
