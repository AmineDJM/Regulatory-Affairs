-- PHARMACOVIGILANCE (Direction, 06/10) : le KAM signale un cas depuis les Rapports terrain, Regulatory le reçoit,
-- l'instruit, ouvre au besoin une enquête approfondie, et l'échange réunit le KAM, Regulatory et les personnes
-- ajoutées. Additif et idempotent.
--
-- La valeur d'énumération neuve n'est PAS utilisée dans cette migration (elle ne peut pas servir dans la
-- transaction qui l'ajoute) : les pièces et commentaires du cas l'emploieront à l'exécution.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PHARMACOVIGILANCE_CASE';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PvCaseStatus') THEN
    CREATE TYPE "PvCaseStatus" AS ENUM ('RECU', 'EN_ANALYSE', 'ENQUETE', 'CLOS');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PvSeverity') THEN
    CREATE TYPE "PvSeverity" AS ENUM ('NON_GRAVE', 'GRAVE', 'DECES', 'INCONNU');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PharmacovigilanceCase" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "status" "PvCaseStatus" NOT NULL DEFAULT 'RECU',
  "promoProductId" TEXT,
  "productId" TEXT,
  "productLabel" TEXT NOT NULL,
  "institutionId" TEXT,
  "institutionName" TEXT NOT NULL,
  "doctorName" TEXT,
  "occurredOn" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "patientAge" INTEGER,
  "patientSex" TEXT,
  "severity" "PvSeverity",
  "investigationOpenedAt" TIMESTAMP(3),
  "investigationOpenedById" TEXT,
  "requestedInfo" TEXT,
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "closingNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PharmacovigilanceCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacovigilanceCase_reference_key" ON "PharmacovigilanceCase"("reference");
CREATE INDEX IF NOT EXISTS "PharmacovigilanceCase_reporterId_idx" ON "PharmacovigilanceCase"("reporterId");
CREATE INDEX IF NOT EXISTS "PharmacovigilanceCase_status_idx" ON "PharmacovigilanceCase"("status");
CREATE INDEX IF NOT EXISTS "PharmacovigilanceCase_occurredOn_idx" ON "PharmacovigilanceCase"("occurredOn");
CREATE INDEX IF NOT EXISTS "PharmacovigilanceCase_promoProductId_idx" ON "PharmacovigilanceCase"("promoProductId");

CREATE TABLE IF NOT EXISTS "PharmacovigilanceParticipant" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "addedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PharmacovigilanceParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacovigilanceParticipant_caseId_userId_key" ON "PharmacovigilanceParticipant"("caseId", "userId");
CREATE INDEX IF NOT EXISTS "PharmacovigilanceParticipant_userId_idx" ON "PharmacovigilanceParticipant"("userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacovigilanceParticipant_caseId_fkey') THEN
    ALTER TABLE "PharmacovigilanceParticipant" ADD CONSTRAINT "PharmacovigilanceParticipant_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "PharmacovigilanceCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
