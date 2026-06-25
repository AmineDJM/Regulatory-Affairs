-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'SALARY_ADVANCE';

-- AlterEnum
ALTER TYPE "FinanceCategory" ADD VALUE 'AVANCE';

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "custom" JSONB,
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "transactionId" TEXT,
    "paidDate" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryAdvance_employeeId_idx" ON "SalaryAdvance"("employeeId");

-- CreateIndex
CREATE INDEX "SalaryAdvance_status_idx" ON "SalaryAdvance"("status");

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

