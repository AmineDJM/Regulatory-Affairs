-- CreateEnum
CREATE TYPE "MedicalInfoStatus" AS ENUM ('AWAITING_REVIEW', 'DOCS_REQUESTED', 'READY', 'VALIDATED');

-- CreateEnum
CREATE TYPE "DocRequestStatus" AS ENUM ('PENDING', 'FULFILLED');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'MEDICAL_INFO_DECLARATION';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MEDICAL_INFO_PHARMACIST';

-- CreateTable
CREATE TABLE "MedicalInfoDeclaration" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sourceType" "EntityType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "beneficiary" TEXT,
    "amount" DECIMAL(14,2),
    "requesterId" TEXT,
    "status" "MedicalInfoStatus" NOT NULL DEFAULT 'AWAITING_REVIEW',
    "pharmacistId" TEXT,
    "authorityRef" TEXT,
    "authorityNotes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "expenseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalInfoDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalInfoDocRequest" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetUserId" TEXT,
    "status" "DocRequestStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "note" TEXT,
    "requestedById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalInfoDocRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalInfoDeclaration_reference_key" ON "MedicalInfoDeclaration"("reference");

-- CreateIndex
CREATE INDEX "MedicalInfoDeclaration_status_idx" ON "MedicalInfoDeclaration"("status");

-- CreateIndex
CREATE INDEX "MedicalInfoDeclaration_pharmacistId_idx" ON "MedicalInfoDeclaration"("pharmacistId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalInfoDeclaration_sourceType_sourceId_key" ON "MedicalInfoDeclaration"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "MedicalInfoDocRequest_declarationId_idx" ON "MedicalInfoDocRequest"("declarationId");

-- CreateIndex
CREATE INDEX "MedicalInfoDocRequest_targetUserId_idx" ON "MedicalInfoDocRequest"("targetUserId");

-- CreateIndex
CREATE INDEX "MedicalInfoDocRequest_status_idx" ON "MedicalInfoDocRequest"("status");

-- AddForeignKey
ALTER TABLE "MedicalInfoDeclaration" ADD CONSTRAINT "MedicalInfoDeclaration_pharmacistId_fkey" FOREIGN KEY ("pharmacistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalInfoDocRequest" ADD CONSTRAINT "MedicalInfoDocRequest_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "MedicalInfoDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalInfoDocRequest" ADD CONSTRAINT "MedicalInfoDocRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

