-- Regulatory Intelligence OS — G8 : boucle fournisseur (demandes + questions). Idempotent.
DO $$ BEGIN CREATE TYPE "RegSupplierStatus" AS ENUM ('DRAFT','SENT','RESPONDED','CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RegulatorySupplierRequest" (
  "id" TEXT NOT NULL,
  "dossierId" TEXT NOT NULL,
  "supplierName" TEXT,
  "supplierEmail" TEXT,
  "subject" TEXT NOT NULL,
  "emailDraft" TEXT,
  "status" "RegSupplierStatus" NOT NULL DEFAULT 'DRAFT',
  "deadline" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "remindedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "responseNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySupplierRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatorySupplierRequest_dossierId_idx" ON "RegulatorySupplierRequest"("dossierId");

CREATE TABLE IF NOT EXISTS "RegulatorySupplierQuestion" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL DEFAULT 0,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "answered" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatorySupplierQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegulatorySupplierQuestion_requestId_idx" ON "RegulatorySupplierQuestion"("requestId");

DO $$ BEGIN ALTER TABLE "RegulatorySupplierRequest" ADD CONSTRAINT "RegulatorySupplierRequest_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TABLE "RegulatorySupplierQuestion" ADD CONSTRAINT "RegulatorySupplierQuestion_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RegulatorySupplierRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;
