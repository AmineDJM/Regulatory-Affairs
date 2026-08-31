-- FORCE DE VENTE — la boucle terrain se ferme : saisie du KAM, alertes de supervision,
-- et l'INSTANTANÉ MENSUEL qui fige ce qui était vrai ce mois-là.
--
-- Idempotent de bout en bout (IF NOT EXISTS partout) : le déploiement peut rejouer.

-- 1) Anti-spam des alertes de supervision : la même alerte ne repart pas dans le même cycle.
ALTER TABLE "SalesRepProfile" ADD COLUMN IF NOT EXISTS "lastAlertKey" TEXT;
ALTER TABLE "SalesRepProfile" ADD COLUMN IF NOT EXISTS "lastAlertAt" TIMESTAMP(3);

-- 2) L'instantané mensuel par KAM. Le mois clos ne se recalcule plus : un panel modifié en
--    juin ne doit pas réécrire la couverture de mars.
CREATE TABLE IF NOT EXISTS "SalesRepMonthlyKpi" (
  "id"             TEXT NOT NULL,
  "repId"          TEXT NOT NULL,
  "year"           INTEGER NOT NULL,
  "month"          INTEGER NOT NULL,
  "teamId"         TEXT,
  "panelSize"      INTEGER NOT NULL DEFAULT 0,
  "capacity"       INTEGER NOT NULL DEFAULT 0,
  "plannedVisits"  INTEGER NOT NULL DEFAULT 0,
  "requiredVisits" INTEGER NOT NULL DEFAULT 0,
  "realVisits"     INTEGER NOT NULL DEFAULT 0,
  "coveredDoctors" INTEGER NOT NULL DEFAULT 0,
  "realizationPct" INTEGER NOT NULL DEFAULT 0,
  "coveragePct"    INTEGER NOT NULL DEFAULT 0,
  "closedAt"       TIMESTAMP(3),
  "computedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesRepMonthlyKpi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesRepMonthlyKpi_repId_year_month_key"
  ON "SalesRepMonthlyKpi" ("repId", "year", "month");
CREATE INDEX IF NOT EXISTS "SalesRepMonthlyKpi_year_month_idx"
  ON "SalesRepMonthlyKpi" ("year", "month");
CREATE INDEX IF NOT EXISTS "SalesRepMonthlyKpi_teamId_idx"
  ON "SalesRepMonthlyKpi" ("teamId");
