-- CreateEnum
CREATE TYPE "AdminRequestType" AS ENUM ('TRAVEL', 'MAIL', 'SIGNATURE', 'PURCHASE', 'QUOTE', 'PAYMENT', 'DRIVER', 'GUEST_VISA', 'HR_SIMPLE', 'OTHER');

-- CreateEnum
CREATE TYPE "AdminRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'AWAITING_VALIDATION', 'AWAITING_EXTERNAL', 'AWAITING_PAYMENT', 'AWAITING_DOCUMENT', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdminApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "DriverMissionStatus" AS ENUM ('NEW', 'ACCEPTED', 'EN_ROUTE', 'DONE', 'PROBLEM', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntityType" ADD VALUE 'ADMIN_REQUEST';
ALTER TYPE "EntityType" ADD VALUE 'DRIVER_MISSION';

-- CreateTable
CREATE TABLE "AdministrativeRequest" (
    "custom" JSONB,
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AdminRequestType" NOT NULL,
    "subtype" TEXT,
    "status" "AdminRequestStatus" NOT NULL DEFAULT 'NEW',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "fields" JSONB,
    "requesterId" TEXT,
    "concernedUserId" TEXT,
    "assignedToId" TEXT,
    "validatorId" TEXT,
    "departmentId" TEXT,
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'INTERNAL',
    "linkedEntityType" "EntityType",
    "linkedEntityId" TEXT,
    "blockedReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdministrativeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminApproval" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestedById" TEXT,
    "validatorId" TEXT,
    "status" "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'DZD',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverMission" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "title" TEXT NOT NULL,
    "assignedToId" TEXT,
    "startLocation" TEXT,
    "destination" TEXT,
    "address" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "instructions" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "DriverMissionStatus" NOT NULL DEFAULT 'NEW',
    "proofType" TEXT,
    "proofComment" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverMission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdministrativeRequest_reference_key" ON "AdministrativeRequest"("reference");

-- CreateIndex
CREATE INDEX "AdministrativeRequest_status_idx" ON "AdministrativeRequest"("status");

-- CreateIndex
CREATE INDEX "AdministrativeRequest_type_idx" ON "AdministrativeRequest"("type");

-- CreateIndex
CREATE INDEX "AdministrativeRequest_assignedToId_idx" ON "AdministrativeRequest"("assignedToId");

-- CreateIndex
CREATE INDEX "AdministrativeRequest_requesterId_idx" ON "AdministrativeRequest"("requesterId");

-- CreateIndex
CREATE INDEX "AdministrativeRequest_priority_idx" ON "AdministrativeRequest"("priority");

-- CreateIndex
CREATE INDEX "AdministrativeRequest_deadline_idx" ON "AdministrativeRequest"("deadline");

-- CreateIndex
CREATE INDEX "AdminApproval_requestId_idx" ON "AdminApproval"("requestId");

-- CreateIndex
CREATE INDEX "AdminApproval_validatorId_status_idx" ON "AdminApproval"("validatorId", "status");

-- CreateIndex
CREATE INDEX "DriverMission_assignedToId_status_idx" ON "DriverMission"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "DriverMission_requestId_idx" ON "DriverMission"("requestId");

-- AddForeignKey
ALTER TABLE "AdministrativeRequest" ADD CONSTRAINT "AdministrativeRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeRequest" ADD CONSTRAINT "AdministrativeRequest_concernedUserId_fkey" FOREIGN KEY ("concernedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeRequest" ADD CONSTRAINT "AdministrativeRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeRequest" ADD CONSTRAINT "AdministrativeRequest_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdministrativeRequest" ADD CONSTRAINT "AdministrativeRequest_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApproval" ADD CONSTRAINT "AdminApproval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AdministrativeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApproval" ADD CONSTRAINT "AdminApproval_validatorId_fkey" FOREIGN KEY ("validatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverMission" ADD CONSTRAINT "DriverMission_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AdministrativeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverMission" ADD CONSTRAINT "DriverMission_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

