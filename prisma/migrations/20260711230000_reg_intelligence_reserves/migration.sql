-- Regulatory Intelligence OS — G9 : réserves ANPP (cycles + points). Idempotent.
DO $$ BEGIN CREATE TYPE "RegReservePointStatus" AS ENUM ('OPEN','DRAFTED','APPROVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatoryReserveCycle" (
  "id" TEXT NOT NULL,
  "dossierId" TEXT NOT NULL,
  "cycle" INTEGER NOT NULL DEFAULT 1,
  "letterFilename" TEXT NOT NULL,
  "letterBlobId" TEXT,
  "ocrText" TEXT,
  "ocrConfidence" DOUBLE PRECISION,
  "ocrNeedsReview" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryReserveCycle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryReserveCycle_dossierId_idx" ON "RegulatoryReserveCycle"("dossierId");

CREATE TABLE IF NOT EXISTS "RegulatoryReservePoint" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "category" TEXT NOT NULL DEFAULT 'AUTRE',
  "verbatim" TEXT NOT NULL,
  "proposedResponse" TEXT,
  "finalResponse" TEXT,
  "evidence" TEXT,
  "status" "RegReservePointStatus" NOT NULL DEFAULT 'OPEN',
  "assignedToId" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryReservePoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatoryReservePoint_cycleId_idx" ON "RegulatoryReservePoint"("cycleId");

DO $$ BEGIN ALTER TABLE "RegulatoryReserveCycle" ADD CONSTRAINT "RegulatoryReserveCycle_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "RegulatoryReservePoint" ADD CONSTRAINT "RegulatoryReservePoint_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RegulatoryReserveCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
