-- Batch K — idempotent.
-- Regulatory : détenteur de DE + variation d'enregistrement (fabrication locale).
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "deHolder" TEXT;
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "manufacturingVariation" TEXT;
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "variationDate" TIMESTAMP(3);

-- Employé : éléments de salaire du bulletin.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "retSS9" DECIMAL(12,2);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "retSS35" DECIMAL(12,2);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "tfp" DECIMAL(12,2);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "retIrg" DECIMAL(12,2);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "expenseRefund" DECIMAL(12,2);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "netToPay" DECIMAL(12,2);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "grossSalary" DECIMAL(12,2);

-- Paie : fiche de paie, notification différée (24 h), transfert budgétaire.
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "payslipDocumentId" TEXT;
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "employeeNotifyAt" TIMESTAMP(3);
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "employeeNotifiedAt" TIMESTAMP(3);
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "budgetTransferredAt" TIMESTAMP(3);
ALTER TABLE "PayrollEntry" ADD COLUMN IF NOT EXISTS "budgetCategoryId" TEXT;
CREATE INDEX IF NOT EXISTS "PayrollEntry_employeeNotifyAt_idx" ON "PayrollEntry"("employeeNotifyAt");

-- Drive : capacité globale + quota par utilisateur (Administration).
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "driveCapacityGb" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "driveUserQuotaGb" INTEGER NOT NULL DEFAULT 10;

-- Corbeille des suppressions définitives (restaurable, Super Admin).
CREATE TABLE IF NOT EXISTS "DeletedRecord" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "documents" JSONB,
    "comments" JSONB,
    "deletedById" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "DeletedRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeletedRecord_kind_idx" ON "DeletedRecord"("kind");
CREATE INDEX IF NOT EXISTS "DeletedRecord_deletedAt_idx" ON "DeletedRecord"("deletedAt");
