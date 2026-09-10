-- LE PLAN DE TOURNÉE — la période, l'échéance, la validation N+1/N+2, et les messages
-- pré-définis de la Direction Marketing.
--
-- Idempotent : `IF NOT EXISTS` partout, types et contraintes posés par bloc conditionnel. Le
-- circuit documenté est `db:deploy` (jamais `psql` à la main — §118.110).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TourPlanGranularity') THEN
    CREATE TYPE "TourPlanGranularity" AS ENUM ('WEEK', 'MONTH', 'QUARTER', 'HALF_YEAR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TourPlanStatus') THEN
    CREATE TYPE "TourPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ESCALATED', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VisitOrigin') THEN
    CREATE TYPE "VisitOrigin" AS ENUM ('PLAN', 'UNPLANNED', 'DIRECTION');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TourPlan" (
    "id"               TEXT NOT NULL,
    "repId"            TEXT NOT NULL,
    "periodStart"      TIMESTAMP(3) NOT NULL,
    "periodEnd"        TIMESTAMP(3) NOT NULL,
    "granularity"      "TourPlanGranularity" NOT NULL DEFAULT 'MONTH',
    "status"           "TourPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submissionDueAt"  TIMESTAMP(3) NOT NULL,
    "submittedAt"      TIMESTAMP(3),
    "reviewerId"       TEXT,
    "escalatedToId"    TEXT,
    "escalatedAt"      TIMESTAMP(3),
    "decidedAt"        TIMESTAMP(3),
    "decidedById"      TEXT,
    "rejectionComment" TEXT,
    "resubmitDueAt"    TIMESTAMP(3),
    "createdById"      TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TourPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PromoMessage" (
    "id"             TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "body"           TEXT,
    "businessUnitId" TEXT,
    "productId"      TEXT,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"      INTEGER NOT NULL DEFAULT 0,
    "createdById"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedicalVisitMessage" (
    "id"        TEXT NOT NULL,
    "visitId"   TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalVisitMessage_pkey" PRIMARY KEY ("id")
);

-- UNE VISITE PLANIFIÉE EST UNE `MedicalVisit` : le plan ne porte pas de table jumelle, il se
-- rattache par cette colonne (§118.5 — deux dénominateurs pour « visitées / planifiées »
-- divergeraient toujours). NUL = visite hors plan, ce qui EST une visite imprévue.
ALTER TABLE "MedicalVisit" ADD COLUMN IF NOT EXISTS "tourPlanId" TEXT;
ALTER TABLE "MedicalVisit" ADD COLUMN IF NOT EXISTS "origin" "VisitOrigin" NOT NULL DEFAULT 'PLAN';
-- LE RAPPORT VOCAL et la visite qu'il documente : le lien manquait, donc l'emploi du temps ne
-- pouvait pas passer au vert sur un rapport dicté.
ALTER TABLE "FieldReport" ADD COLUMN IF NOT EXISTS "visitId" TEXT;
-- LA MAILLE DE PLANIFICATION, dans le réglage SFE qui existe déjà.
ALTER TABLE "SfeSettings" ADD COLUMN IF NOT EXISTS "tourPlanning" JSONB;

-- UN SEUL PLAN par KAM et par période : un rejet ne crée pas un second plan, c'est le MÊME qui
-- repasse en soumission — sans quoi l'historique de la décision se perdrait.
CREATE UNIQUE INDEX IF NOT EXISTS "TourPlan_repId_periodStart_periodEnd_key" ON "TourPlan"("repId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "TourPlan_repId_status_idx" ON "TourPlan"("repId", "status");
CREATE INDEX IF NOT EXISTS "TourPlan_reviewerId_status_idx" ON "TourPlan"("reviewerId", "status");
CREATE INDEX IF NOT EXISTS "TourPlan_escalatedToId_status_idx" ON "TourPlan"("escalatedToId", "status");
CREATE INDEX IF NOT EXISTS "PromoMessage_businessUnitId_idx" ON "PromoMessage"("businessUnitId");
CREATE INDEX IF NOT EXISTS "PromoMessage_productId_idx" ON "PromoMessage"("productId");
CREATE UNIQUE INDEX IF NOT EXISTS "MedicalVisitMessage_visitId_messageId_key" ON "MedicalVisitMessage"("visitId", "messageId");
CREATE INDEX IF NOT EXISTS "MedicalVisitMessage_messageId_idx" ON "MedicalVisitMessage"("messageId");
CREATE INDEX IF NOT EXISTS "MedicalVisit_tourPlanId_idx" ON "MedicalVisit"("tourPlanId");
CREATE INDEX IF NOT EXISTS "FieldReport_visitId_idx" ON "FieldReport"("visitId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourPlan_repId_fkey') THEN
    ALTER TABLE "TourPlan" ADD CONSTRAINT "TourPlan_repId_fkey"
      FOREIGN KEY ("repId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourPlan_reviewerId_fkey') THEN
    ALTER TABLE "TourPlan" ADD CONSTRAINT "TourPlan_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourPlan_escalatedToId_fkey') THEN
    ALTER TABLE "TourPlan" ADD CONSTRAINT "TourPlan_escalatedToId_fkey"
      FOREIGN KEY ("escalatedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TourPlan_decidedById_fkey') THEN
    ALTER TABLE "TourPlan" ADD CONSTRAINT "TourPlan_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalVisit_tourPlanId_fkey') THEN
    ALTER TABLE "MedicalVisit" ADD CONSTRAINT "MedicalVisit_tourPlanId_fkey"
      FOREIGN KEY ("tourPlanId") REFERENCES "TourPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FieldReport_visitId_fkey') THEN
    ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_visitId_fkey"
      FOREIGN KEY ("visitId") REFERENCES "MedicalVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoMessage_businessUnitId_fkey') THEN
    ALTER TABLE "PromoMessage" ADD CONSTRAINT "PromoMessage_businessUnitId_fkey"
      FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoMessage_productId_fkey') THEN
    ALTER TABLE "PromoMessage" ADD CONSTRAINT "PromoMessage_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalVisitMessage_visitId_fkey') THEN
    ALTER TABLE "MedicalVisitMessage" ADD CONSTRAINT "MedicalVisitMessage_visitId_fkey"
      FOREIGN KEY ("visitId") REFERENCES "MedicalVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalVisitMessage_messageId_fkey') THEN
    ALTER TABLE "MedicalVisitMessage" ADD CONSTRAINT "MedicalVisitMessage_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "PromoMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

