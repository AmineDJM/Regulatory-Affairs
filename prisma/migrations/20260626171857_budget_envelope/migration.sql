-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN     "budgetCategoryId" TEXT;

-- CreateTable
CREATE TABLE "BudgetEnvelope" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCategoryLine" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allocated" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "color" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCategoryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetEnvelope_isActive_idx" ON "BudgetEnvelope"("isActive");

-- CreateIndex
CREATE INDEX "BudgetEnvelope_periodStart_idx" ON "BudgetEnvelope"("periodStart");

-- CreateIndex
CREATE INDEX "BudgetCategoryLine_envelopeId_idx" ON "BudgetCategoryLine"("envelopeId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_budgetCategoryId_idx" ON "FinanceTransaction"("budgetCategoryId");

-- AddForeignKey
ALTER TABLE "BudgetCategoryLine" ADD CONSTRAINT "BudgetCategoryLine_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "BudgetEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_budgetCategoryId_fkey" FOREIGN KEY ("budgetCategoryId") REFERENCES "BudgetCategoryLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

