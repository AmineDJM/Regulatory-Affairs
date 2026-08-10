-- POSTES AD & PRO : deux parents de plus (prises en charge internationales, événements), un
-- CYCLE DE VALIDATION propre à chaque poste, la nature budgétaire (inclus / supplémentaire),
-- le lien vers la demande de devis et l'émission du bon de commande. Idempotent.

-- 1) Natures de poste supplémentaires (consulting, traiteur, location de salle).
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'CONSULTING';
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'CATERING';
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'VENUE';

-- 2) Nouveaux types énumérés.
DO $$ BEGIN
    CREATE TYPE "AdProItemStatus" AS ENUM ('DRAFT', 'PENDING', 'REVISION', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "AdProItemBudgetKind" AS ENUM ('INCLUDED', 'ADDITIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "AdProItemOrderStage" AS ENUM ('NONE', 'REQUESTED', 'DIRECTION_OK', 'ISSUED', 'REFUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Colonnes du poste.
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "congressInternationalId" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "status" "AdProItemStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "budgetKind" "AdProItemBudgetKind" NOT NULL DEFAULT 'INCLUDED';
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "decidedAt" TIMESTAMP(3);
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "decidedById" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "budgetCategoryId" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "adminRequestId" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderStage" "AdProItemOrderStage" NOT NULL DEFAULT 'NONE';
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderRequestedAt" TIMESTAMP(3);
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderRequestedById" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderDirectionAt" TIMESTAMP(3);
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderDirectionById" TEXT;
ALTER TABLE "AdProItem" ADD COLUMN IF NOT EXISTS "orderNote" TEXT;

-- 4) EXISTANT : les postes déjà saisis (avant ce cycle) sont réputés ACCORDÉS. Les laisser en
--    brouillon les ferait disparaître des ventilations en cours — une régression silencieuse.
UPDATE "AdProItem" SET "status" = 'APPROVED' WHERE "status" = 'DRAFT' AND "amountGranted" IS NOT NULL;

-- 5) Un poste déjà payé garde la trace de son bon de commande émis.
UPDATE "AdProItem" SET "orderStage" = 'ISSUED' WHERE "expenseOrderId" IS NOT NULL AND "orderStage" = 'NONE';

-- 6) Index.
CREATE INDEX IF NOT EXISTS "AdProItem_congressInternationalId_idx" ON "AdProItem"("congressInternationalId");
CREATE INDEX IF NOT EXISTS "AdProItem_eventId_idx" ON "AdProItem"("eventId");
CREATE INDEX IF NOT EXISTS "AdProItem_status_idx" ON "AdProItem"("status");

-- 7) Clés étrangères (cascade garantie par la base — un congrès supprimé n'abandonne pas ses postes).
DO $$ BEGIN
    ALTER TABLE "AdProItem" ADD CONSTRAINT "AdProItem_congressInternationalId_fkey"
        FOREIGN KEY ("congressInternationalId") REFERENCES "CongressInternational"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AdProItem" ADD CONSTRAINT "AdProItem_eventId_fkey"
        FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AdProItem" ADD CONSTRAINT "AdProItem_budgetCategoryId_fkey"
        FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategoryLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AdProItem" ADD CONSTRAINT "AdProItem_adminRequestId_fkey"
        FOREIGN KEY ("adminRequestId") REFERENCES "AdministrativeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8) EXACTEMENT un parent — la garde s'étend aux quatre colonnes (sinon un poste d'événement
--    violerait l'ancienne contrainte, écrite pour deux).
ALTER TABLE "AdProItem" DROP CONSTRAINT IF EXISTS "AdProItem_one_parent";
DO $$ BEGIN
    ALTER TABLE "AdProItem"
        ADD CONSTRAINT "AdProItem_one_parent"
        CHECK (
            ("sponsoringId" IS NOT NULL)::int
          + ("congressNationalId" IS NOT NULL)::int
          + ("congressInternationalId" IS NOT NULL)::int
          + ("eventId" IS NOT NULL)::int = 1
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9) Historique des décisions d'un poste (aller-retours illimités).
CREATE TABLE IF NOT EXISTS "AdProItemDecision" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "decision" "AdProItemStatus" NOT NULL,
    "note" TEXT,
    "amount" DECIMAL(14,2),
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdProItemDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdProItemDecision_itemId_at_idx" ON "AdProItemDecision"("itemId", "at");

DO $$ BEGIN
    ALTER TABLE "AdProItemDecision" ADD CONSTRAINT "AdProItemDecision_itemId_fkey"
        FOREIGN KEY ("itemId") REFERENCES "AdProItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "AdProItemDecision" ADD CONSTRAINT "AdProItemDecision_byId_fkey"
        FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
