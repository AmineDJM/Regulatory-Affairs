-- BILLETTERIE — TRAJET, MODE DE TRANSPORT, DEVIS PAR VOYAGEUR (§118.205, Direction 04/10/2026).
--
-- Idempotente : types créés s'ils manquent, colonnes et index « IF NOT EXISTS ». Un voyageur d'avant
-- reste ALLER-RETOUR (il portait déjà une date de retour, ou rien) et sans mode de transport dit.
-- Rien n'est rattaché à un voyageur d'après un nom : un devis d'avant reste un devis du POSTE.

DO $$ BEGIN
  CREATE TYPE "AdProTrajet" AS ENUM ('ALLER_SIMPLE', 'ALLER_RETOUR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AdProTransport" AS ENUM ('AVION', 'TRAIN', 'BUS', 'TAXI');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "AdProVoyageur" ADD COLUMN IF NOT EXISTS "trajet" "AdProTrajet" NOT NULL DEFAULT 'ALLER_RETOUR';
ALTER TABLE "AdProVoyageur" ADD COLUMN IF NOT EXISTS "transport" "AdProTransport";

CREATE TABLE IF NOT EXISTS "AdProVoyageurDevis" (
  "id" TEXT NOT NULL,
  "voyageurId" TEXT NOT NULL,
  "pieceId" TEXT NOT NULL,
  "retenuLe" TIMESTAMP(3),
  "retenuParId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProVoyageurDevis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdProVoyageurDevis_pieceId_key" ON "AdProVoyageurDevis"("pieceId");
CREATE INDEX IF NOT EXISTS "AdProVoyageurDevis_voyageurId_idx" ON "AdProVoyageurDevis"("voyageurId");
-- AU PLUS UNE PROPOSITION RETENUE PAR VOYAGEUR : deux validations croisées n'en posent qu'une.
-- Le schéma Prisma ne sait pas déclarer un index partiel : c'est la base qui tient la règle.
CREATE UNIQUE INDEX IF NOT EXISTS "AdProVoyageurDevis_un_retenu" ON "AdProVoyageurDevis"("voyageurId") WHERE "retenuLe" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "AdProVoyageurDevis" ADD CONSTRAINT "AdProVoyageurDevis_voyageurId_fkey"
    FOREIGN KEY ("voyageurId") REFERENCES "AdProVoyageur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AdProVoyageurDevis" ADD CONSTRAINT "AdProVoyageurDevis_pieceId_fkey"
    FOREIGN KEY ("pieceId") REFERENCES "AdProItemPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
