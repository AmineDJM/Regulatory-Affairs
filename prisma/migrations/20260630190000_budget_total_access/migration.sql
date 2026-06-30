-- Budget total (mode fixe/flexible) + accès par enveloppe.
ALTER TABLE "AppSetting" ADD COLUMN "budgetTotalMode" TEXT NOT NULL DEFAULT 'FLEXIBLE';
ALTER TABLE "AppSetting" ADD COLUMN "budgetFixedTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "BudgetEnvelope" ADD COLUMN "accessRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
