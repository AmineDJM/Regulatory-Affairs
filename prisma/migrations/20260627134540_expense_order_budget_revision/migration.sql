-- AlterEnum
ALTER TYPE "ExpenseOrderStatus" ADD VALUE 'REVISION_REQUESTED';

-- AlterTable
ALTER TABLE "ExpenseOrder" ADD COLUMN     "proposedAmount" DECIMAL(14,2),
ADD COLUMN     "revisionById" TEXT,
ADD COLUMN     "revisionReason" TEXT;

