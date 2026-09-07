-- Relance des demandes de tâche, parties choisies dans l'annuaire, moyens généraux pour tous,
-- journal des demandes d'achat. SQL manuel IDEMPOTENT.

-- 1. RELANCER quelqu'un sur une demande de tâche.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastNudgeAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "nudgeCount" INTEGER NOT NULL DEFAULT 0;

-- 2. LE SERVICE DES MOYENS GÉNÉRAUX — un seul, pour toute la société.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "generalMeansDepartmentId" TEXT;

-- 3. LES PARTIES, CHOISIES DANS L'ANNUAIRE D'ENTREPRISE.
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "counterpartyIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MailEntry" ADD COLUMN IF NOT EXISTS "senderContactId" TEXT;
ALTER TABLE "MailEntry" ADD COLUMN IF NOT EXISTS "recipientContactId" TEXT;

-- 4. LE JOURNAL DES DEMANDES D'ACHAT — on ajoute, on ne met jamais à jour.
CREATE TABLE IF NOT EXISTS "PurchaseRequestLogEntry" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "requesterId" TEXT,
  "requesterName" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "departmentId" TEXT,
  "departmentName" TEXT,
  "estimatedTotal" DECIMAL(14,2),
  "note" TEXT,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequestLogEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PurchaseRequestLogEntry_requestId_idx" ON "PurchaseRequestLogEntry"("requestId");
CREATE INDEX IF NOT EXISTS "PurchaseRequestLogEntry_createdAt_idx" ON "PurchaseRequestLogEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseRequestLogEntry_requesterId_idx" ON "PurchaseRequestLogEntry"("requesterId");
