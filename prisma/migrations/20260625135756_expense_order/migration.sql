-- CreateEnum
CREATE TYPE "ExpenseOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'EXPENSE_ORDER';

-- CreateTable
CREATE TABLE "ExpenseOrder" (
    "custom" JSONB,
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "beneficiary" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" "FinanceCategory" NOT NULL DEFAULT 'AUTRE',
    "status" "ExpenseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "sourceType" "EntityType",
    "sourceId" TEXT,
    "requestedById" TEXT,
    "paidById" TEXT,
    "transactionId" TEXT,
    "paidDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseOrder_reference_key" ON "ExpenseOrder"("reference");

-- CreateIndex
CREATE INDEX "ExpenseOrder_status_idx" ON "ExpenseOrder"("status");

-- CreateIndex
CREATE INDEX "ExpenseOrder_sourceType_sourceId_idx" ON "ExpenseOrder"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "ExpenseOrder" ADD CONSTRAINT "ExpenseOrder_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

