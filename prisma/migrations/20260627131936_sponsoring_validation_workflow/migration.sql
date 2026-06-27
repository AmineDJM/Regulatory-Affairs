-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SponsoringStatus" ADD VALUE 'AWAITING_PRELIMINARY';
ALTER TYPE "SponsoringStatus" ADD VALUE 'PRELIMINARY_APPROVED';
ALTER TYPE "SponsoringStatus" ADD VALUE 'AWAITING_FINAL';
ALTER TYPE "SponsoringStatus" ADD VALUE 'APPROVED';
ALTER TYPE "SponsoringStatus" ADD VALUE 'APPEAL_PENDING';
ALTER TYPE "SponsoringStatus" ADD VALUE 'AWAITING_FINAL_APPEAL';
ALTER TYPE "SponsoringStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "SponsoringRequest" ADD COLUMN     "appealAt" TIMESTAMP(3),
ADD COLUMN     "appealById" TEXT,
ADD COLUMN     "appealCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "appealReason" TEXT,
ADD COLUMN     "expenseOrderId" TEXT,
ADD COLUMN     "finalAt" TIMESTAMP(3),
ADD COLUMN     "finalById" TEXT,
ADD COLUMN     "preliminaryAt" TIMESTAMP(3),
ADD COLUMN     "preliminaryById" TEXT,
ADD COLUMN     "preliminaryNote" TEXT,
ADD COLUMN     "productManagerBudget" DECIMAL(12,2),
ADD COLUMN     "productManagerId" TEXT,
ADD COLUMN     "productManagerNotes" TEXT;

-- CreateIndex
CREATE INDEX "SponsoringRequest_productManagerId_idx" ON "SponsoringRequest"("productManagerId");

