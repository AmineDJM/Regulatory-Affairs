-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'SEEN', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "ValidationMode" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ValidationStepState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'FEEDBACK';
ALTER TYPE "EntityType" ADD VALUE 'VALIDATION_REQUEST';

-- CreateTable
CREATE TABLE "ValidationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT,
    "objectType" TEXT,
    "description" TEXT,
    "minAmount" DECIMAL(16,2),
    "maxAmount" DECIMAL(16,2),
    "department" TEXT,
    "requesterRole" "UserRole",
    "priority" "Priority",
    "category" TEXT,
    "validator1Id" TEXT,
    "validator2Id" TEXT,
    "mode" "ValidationMode" NOT NULL DEFAULT 'SEQUENTIAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "ruleId" TEXT,
    "module" TEXT NOT NULL,
    "objectType" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(16,2),
    "department" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "link" TEXT,
    "entityType" "EntityType",
    "entityId" TEXT,
    "requesterId" TEXT NOT NULL,
    "mode" "ValidationMode" NOT NULL DEFAULT 'SEQUENTIAL',
    "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "currentOrder" INTEGER NOT NULL DEFAULT 1,
    "deadline" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "validatorId" TEXT NOT NULL,
    "status" "ValidationStepState" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "handledById" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ValidationRule_active_idx" ON "ValidationRule"("active");

-- CreateIndex
CREATE INDEX "ValidationRule_module_idx" ON "ValidationRule"("module");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRequest_reference_key" ON "ValidationRequest"("reference");

-- CreateIndex
CREATE INDEX "ValidationRequest_status_idx" ON "ValidationRequest"("status");

-- CreateIndex
CREATE INDEX "ValidationRequest_requesterId_idx" ON "ValidationRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ValidationStep_validatorId_status_idx" ON "ValidationStep"("validatorId", "status");

-- CreateIndex
CREATE INDEX "ValidationStep_requestId_idx" ON "ValidationStep"("requestId");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- AddForeignKey
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ValidationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRequest" ADD CONSTRAINT "ValidationRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationStep" ADD CONSTRAINT "ValidationStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ValidationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationStep" ADD CONSTRAINT "ValidationStep_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

