-- CreateEnum
CREATE TYPE "CongressRequestStatus" AS ENUM ('AWAITING_PRELIMINARY', 'PRELIMINARY_APPROVED', 'AWAITING_FINAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NationalEventType" AS ENUM ('CONGRESS', 'SEMINAR', 'ROUND_TABLE', 'WEBINAR', 'WORKSHOP', 'SYMPOSIUM', 'STAFF', 'OTHER');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'PRODUCT_MANAGER';

-- AlterTable
ALTER TABLE "CongressInternational" ADD COLUMN     "estimatedBudget" DECIMAL(14,2),
ADD COLUMN     "expenseOrderId" TEXT,
ADD COLUMN     "finalAt" TIMESTAMP(3),
ADD COLUMN     "finalById" TEXT,
ADD COLUMN     "finalNote" TEXT,
ADD COLUMN     "invitedDoctorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preliminaryAt" TIMESTAMP(3),
ADD COLUMN     "preliminaryById" TEXT,
ADD COLUMN     "preliminaryNote" TEXT,
ADD COLUMN     "productManagerBudget" DECIMAL(14,2),
ADD COLUMN     "productManagerId" TEXT,
ADD COLUMN     "productManagerNotes" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestStatus" "CongressRequestStatus" NOT NULL DEFAULT 'AWAITING_PRELIMINARY',
ADD COLUMN     "requesterId" TEXT;

-- AlterTable
ALTER TABLE "CongressNational" ADD COLUMN     "estimatedBudget" DECIMAL(14,2),
ADD COLUMN     "eventType" "NationalEventType" NOT NULL DEFAULT 'CONGRESS',
ADD COLUMN     "expenseOrderId" TEXT,
ADD COLUMN     "finalAt" TIMESTAMP(3),
ADD COLUMN     "finalById" TEXT,
ADD COLUMN     "finalNote" TEXT,
ADD COLUMN     "invitedDoctorIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preliminaryAt" TIMESTAMP(3),
ADD COLUMN     "preliminaryById" TEXT,
ADD COLUMN     "preliminaryNote" TEXT,
ADD COLUMN     "productManagerBudget" DECIMAL(14,2),
ADD COLUMN     "productManagerId" TEXT,
ADD COLUMN     "productManagerNotes" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestStatus" "CongressRequestStatus" NOT NULL DEFAULT 'AWAITING_PRELIMINARY',
ADD COLUMN     "requesterId" TEXT;

-- CreateIndex
CREATE INDEX "CongressInternational_requestStatus_idx" ON "CongressInternational"("requestStatus");

-- CreateIndex
CREATE INDEX "CongressInternational_requesterId_idx" ON "CongressInternational"("requesterId");

-- CreateIndex
CREATE INDEX "CongressNational_requestStatus_idx" ON "CongressNational"("requestStatus");

-- CreateIndex
CREATE INDEX "CongressNational_requesterId_idx" ON "CongressNational"("requesterId");

