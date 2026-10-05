-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Force de vente — LE TERRITOIRE D'UN KAM SE CHOISIT SUR SA LIGNE (04/10/2026)
--
-- Demande du dirigeant : « sur l'écran de la BU, dans "KAM de la BU", dans le secteur de chaque
-- KAM, on doit pouvoir sélectionner un ou des services d'un ou de plusieurs établissements
-- hospitaliers de l'annuaire — dans le cas où la BU est hospitalière ; enlève "Secteurs de la BU". »
--
-- Le territoire d'un KAM devient un `SalesSector` qui n'appartient qu'à lui (`repId`). Il garde
-- AUSSI sa ligne `SalesSectorRep` : la règle du panel (`clausePanelDuKam`) et la portée des stocks
-- lisent le territoire par ce lien, et ne changent pas.
--
-- ── LA REPRISE NE PERD RIEN ──────────────────────────────────────────────────────────────────
--
-- Un KAM affecté à un ou plusieurs secteurs PARTAGÉS actifs (repId nul) retrouve EXACTEMENT la
-- même couverture dans son territoire propre :
--   · l'UNION des établissements de ses secteurs ;
--   · « tous les services » si l'UN des anciens liens le disait — un établissement entier
--     couvert par un secteur l'était, quoi que disent les autres ;
--   · sinon l'UNION des services choisis. Un lien restreint SANS aucun service (il ne couvrait
--     personne de cet hôpital, §118.172) reste restreint et vide : on n'élargit rien en silence.
-- Puis ses affectations aux anciens secteurs sont retirées (la couverture vit désormais dans son
-- territoire), et les anciens secteurs devenus sans KAM sont DÉSACTIVÉS, jamais supprimés : un
-- secteur partagé actif sans KAM ne couvrait déjà personne.
--
-- Un secteur partagé INACTIF ne couvrait personne (le panel ne lit que les actifs) : il n'est pas
-- repris, et ses lignes ne bougent pas.
--
-- ── LE NOM ───────────────────────────────────────────────────────────────────────────────────
--
-- « Territoire — <nom du KAM> » ; quand ce nom est déjà pris dans la BU (un ancien secteur, ou
-- deux KAM homonymes), il prend la fin de l'identifiant du KAM (« · a1b2c3 ») — la même règle que
-- `nomDuTerritoire` (`lib/sfe/territoire-kam.ts`), qu'un banc compare à ce fichier.
--
-- ── IDEMPOTENTE ──────────────────────────────────────────────────────────────────────────────
--
-- Identifiants déterministes (md5 de ce qui les définit), `ON CONFLICT DO NOTHING` partout ; au
-- second passage plus aucune affectation à un ancien secteur actif ne reste, donc plus rien ne
-- se reprend. Le banc `lib/sfe/territoire-kam-migration.test.ts` joue ce TEXTE deux fois contre
-- des tables temporaires (§118.173).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "SalesSector" ADD COLUMN IF NOT EXISTS "repId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SalesSector_businessUnitId_repId_key" ON "SalesSector"("businessUnitId", "repId");

DO $$
BEGIN
  ALTER TABLE "SalesSector" ADD CONSTRAINT "SalesSector_repId_fkey"
    FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Un territoire propre par (BU, KAM) affecté à au moins un ancien secteur actif.
INSERT INTO "SalesSector" ("id", "businessUnitId", "name", "repId", "isActive", "createdAt", "updatedAt")
SELECT
  'terr_' || md5(p."businessUnitId" || ':' || p."repId"),
  p."businessUnitId",
  CASE
    WHEN p."homonymes" > 1
      OR EXISTS (SELECT 1 FROM "SalesSector" x WHERE x."businessUnitId" = p."businessUnitId" AND lower(x."name") = lower(p."nom"))
    THEN p."nom" || ' · ' || right(p."repId", 6)
    ELSE p."nom"
  END,
  p."repId", true, now(), now()
FROM (
  SELECT q."businessUnitId", q."repId", q."nom",
         count(*) OVER (PARTITION BY q."businessUnitId", lower(q."nom")) AS "homonymes"
  FROM (
    SELECT DISTINCT s."businessUnitId", r."repId",
           'Territoire — ' || coalesce(nullif(btrim(u."name"), ''), 'KAM') AS "nom"
    FROM "SalesSectorRep" r
    JOIN "SalesSector" s ON s."id" = r."sectorId"
    JOIN "User" u ON u."id" = r."repId"
    WHERE s."repId" IS NULL AND s."isActive" = true
  ) q
) p
ON CONFLICT DO NOTHING;

-- 2. L'union des établissements ; « tous les services » si l'un des anciens liens le disait.
INSERT INTO "SalesSectorInstitution" ("id", "sectorId", "institutionId", "tousLesServices", "createdAt")
SELECT 'terri_' || md5(t."id" || ':' || l."institutionId"), t."id", l."institutionId", bool_or(l."tousLesServices"), now()
FROM "SalesSectorRep" r
JOIN "SalesSector" s ON s."id" = r."sectorId" AND s."repId" IS NULL AND s."isActive" = true
JOIN "SalesSectorInstitution" l ON l."sectorId" = s."id"
JOIN "SalesSector" t ON t."businessUnitId" = s."businessUnitId" AND t."repId" = r."repId"
GROUP BY t."id", l."institutionId"
ON CONFLICT DO NOTHING;

-- 3. L'union des services choisis, pour les seuls établissements restés restreints.
INSERT INTO "SalesSectorInstitutionService" ("id", "sectorInstitutionId", "serviceId")
SELECT DISTINCT 'terrs_' || md5(tl."id" || ':' || sv."serviceId"), tl."id", sv."serviceId"
FROM "SalesSectorRep" r
JOIN "SalesSector" s ON s."id" = r."sectorId" AND s."repId" IS NULL AND s."isActive" = true
JOIN "SalesSectorInstitution" l ON l."sectorId" = s."id" AND l."tousLesServices" = false
JOIN "SalesSectorInstitutionService" sv ON sv."sectorInstitutionId" = l."id"
JOIN "SalesSector" t ON t."businessUnitId" = s."businessUnitId" AND t."repId" = r."repId"
JOIN "SalesSectorInstitution" tl ON tl."sectorId" = t."id" AND tl."institutionId" = l."institutionId" AND tl."tousLesServices" = false
ON CONFLICT DO NOTHING;

-- 4. Le KAM est affecté à son territoire — c'est ce lien que lisent le panel et les stocks.
INSERT INTO "SalesSectorRep" ("id", "sectorId", "repId", "assignedAt")
SELECT DISTINCT 'terrr_' || md5(t."id"), t."id", r."repId", now()
FROM "SalesSectorRep" r
JOIN "SalesSector" s ON s."id" = r."sectorId" AND s."repId" IS NULL AND s."isActive" = true
JOIN "SalesSector" t ON t."businessUnitId" = s."businessUnitId" AND t."repId" = r."repId"
ON CONFLICT DO NOTHING;

-- 5. Ses affectations aux anciens secteurs actifs sont retirées : la couverture vit dans son territoire.
DELETE FROM "SalesSectorRep" r
USING "SalesSector" s
WHERE r."sectorId" = s."id" AND s."repId" IS NULL AND s."isActive" = true
  AND EXISTS (SELECT 1 FROM "SalesSector" t WHERE t."businessUnitId" = s."businessUnitId" AND t."repId" = r."repId");

-- 6. Les anciens secteurs sans KAM sont désactivés — jamais supprimés.
UPDATE "SalesSector" s
SET "isActive" = false, "updatedAt" = now()
WHERE s."repId" IS NULL AND s."isActive" = true
  AND NOT EXISTS (SELECT 1 FROM "SalesSectorRep" r WHERE r."sectorId" = s."id");
