-- LA BU DEVIENT LA COLONNE VERTÉBRALE DE LA FORCE DE VENTE.
--
-- Avant : une `BusinessUnit` (nom, société, chef) et, EN DESSOUS, une `SalesTeam` qui portait le
-- superviseur et les KAM. Deux objets pour une seule réalité — monter une force de vente
-- demandait de créer la BU dans un onglet, l'équipe dans un autre, et personne ne savait laquelle
-- des deux faisait autorité. Le canal (ville / hôpital) se saisissait produit par produit alors
-- que c'est une propriété de la franchise.
--
-- Après : la BU porte son superviseur, son canal, ses KAM et ses produits. Aucune donnée n'est
-- perdue — chaque équipe est REPRISE dans une BU (la sienne si elle en avait une, une BU créée à
-- son image sinon), et les profils de KAM sont repointés. La table `SalesTeam` n'est PAS
-- supprimée ; elle n'est simplement plus lue.
--
-- Idempotent de bout en bout : rejouable sans effet de bord.

-- ── 1. Les nouvelles colonnes ────────────────────────────────────────────────────────────────
ALTER TABLE "BusinessUnit" ADD COLUMN IF NOT EXISTS "supervisorId" TEXT;
ALTER TABLE "BusinessUnit" ADD COLUMN IF NOT EXISTS "channel" "ProductChannel" NOT NULL DEFAULT 'BOTH';
CREATE INDEX IF NOT EXISTS "BusinessUnit_supervisorId_idx" ON "BusinessUnit" ("supervisorId");

ALTER TABLE "SalesRepProfile" ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT;
CREATE INDEX IF NOT EXISTS "SalesRepProfile_businessUnitId_idx" ON "SalesRepProfile" ("businessUnitId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SalesRepProfile_businessUnitId_fkey'
  ) THEN
    ALTER TABLE "SalesRepProfile"
      ADD CONSTRAINT "SalesRepProfile_businessUnitId_fkey"
      FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 2. Les équipes SANS BU deviennent des BU ────────────────────────────────────────────────
-- L'identifiant est DÉRIVÉ de celui de l'équipe (`bu_` + id) : la reprise est rejouable, et l'on
-- peut retrouver d'où vient chaque BU créée ici.
INSERT INTO "BusinessUnit" ("id", "name", "code", "color", "supervisorId", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT
  'bu_' || t."id", t."name", t."code", t."color", t."supervisorId", t."sortOrder", t."isActive", t."createdAt", NOW()
FROM "SalesTeam" t
WHERE t."businessUnitId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "BusinessUnit" b WHERE b."id" = 'bu_' || t."id");

-- ── 3. Les équipes AVEC une BU lui donnent son superviseur ──────────────────────────────────
-- On n'écrase jamais un superviseur déjà posé : si deux équipes visaient la même BU, la première
-- reprise gagne et la seconde ne défait rien.
UPDATE "BusinessUnit" b
SET "supervisorId" = t."supervisorId"
FROM "SalesTeam" t
WHERE t."businessUnitId" = b."id"
  AND b."supervisorId" IS NULL
  AND t."supervisorId" IS NOT NULL;

-- ── 4. Les KAM rejoignent leur BU ───────────────────────────────────────────────────────────
UPDATE "SalesRepProfile" p
SET "businessUnitId" = COALESCE(t."businessUnitId", 'bu_' || t."id")
FROM "SalesTeam" t
WHERE p."teamId" = t."id"
  AND p."businessUnitId" IS NULL;

-- ── 5. Le canal de la BU se DÉDUIT de ses produits ──────────────────────────────────────────
-- La donnée existe déjà, produit par produit : une BU dont tous les produits sont hospitaliers
-- EST hospitalière. Deviner ici évite de faire ressaisir ce que le système sait — et « les deux »
-- reste le défaut, qui n'exclut rien.
UPDATE "BusinessUnit" b
SET "channel" = s."deduit"::"ProductChannel"
FROM (
  SELECT
    p."businessUnitId" AS "buId",
    CASE
      WHEN bool_and(p."channel" = 'RETAIL')   THEN 'RETAIL'
      WHEN bool_and(p."channel" = 'HOSPITAL') THEN 'HOSPITAL'
      ELSE 'BOTH'
    END AS "deduit"
  FROM "PromoProduct" p
  WHERE p."businessUnitId" IS NOT NULL AND p."isActive" = true
  GROUP BY p."businessUnitId"
) s
WHERE b."id" = s."buId" AND b."channel" = 'BOTH';

-- ── 6. L'instantané mensuel parle le même vocabulaire ───────────────────────────────────────
-- La colonne photographiait « l'équipe du mois » ; l'équipe n'existe plus, c'est la BU.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SalesRepMonthlyKpi' AND column_name = 'teamId')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'SalesRepMonthlyKpi' AND column_name = 'buId')
  THEN
    ALTER TABLE "SalesRepMonthlyKpi" RENAME COLUMN "teamId" TO "buId";
  END IF;
END $$;
ALTER TABLE "SalesRepMonthlyKpi" ADD COLUMN IF NOT EXISTS "buId" TEXT;
DROP INDEX IF EXISTS "SalesRepMonthlyKpi_teamId_idx";
CREATE INDEX IF NOT EXISTS "SalesRepMonthlyKpi_buId_idx" ON "SalesRepMonthlyKpi" ("buId");
