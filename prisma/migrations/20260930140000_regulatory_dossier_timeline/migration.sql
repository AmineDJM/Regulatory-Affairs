-- LA FRISE DU DOSSIER RÉGLEMENTAIRE : CTD initial → réserves ANPP → versions → décision.
-- Idempotent : type, table et index ne sont créés que s'ils manquent. Rejouable sans dommage.

DO $$ BEGIN
  CREATE TYPE "RegulatoryDossierStepKind" AS ENUM (
    'CTD_INITIAL', 'ANPP_RESERVES', 'ANPP_RESPONSE', 'CTD_VERSION', 'DECISION', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryDossierStep" (
  "id"          TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "kind"        "RegulatoryDossierStepKind" NOT NULL,
  "label"       TEXT NOT NULL,
  "version"     INTEGER,
  "order"       INTEGER NOT NULL,
  "occurredAt"  TIMESTAMP(3),
  "note"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryDossierStep_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegulatoryDossierStep_productId_order_idx"
  ON "RegulatoryDossierStep"("productId", "order");

-- UN SEUL CTD INITIAL PAR DOSSIER, garanti par la base.
-- La frise commence toujours par son origine ; deux origines concurrentes (double clic, deux
-- onglets) rendraient l'histoire illisible sans que personne ne comprenne d'où vient le doublon.
-- Un index unique PARTIEL le dit une fois pour toutes — une garde applicative seule perdrait
-- la course.
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryDossierStep_one_initial_per_product"
  ON "RegulatoryDossierStep"("productId") WHERE "kind" = 'CTD_INITIAL';

DO $$ BEGIN
  ALTER TABLE "RegulatoryDossierStep" ADD CONSTRAINT "RegulatoryDossierStep_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "RegulatoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RegulatoryDossierStep" ADD CONSTRAINT "RegulatoryDossierStep_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
