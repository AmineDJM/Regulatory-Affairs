-- CreateEnum
CREATE TYPE "FieldReportStatus" AS ENUM ('DRAFT', 'VALIDATED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "FieldReport" (
    "id" TEXT NOT NULL,
    "delegateId" TEXT,
    "status" "FieldReportStatus" NOT NULL DEFAULT 'DRAFT',
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transcript" TEXT,
    "audioBlobId" TEXT,
    "doctorId" TEXT,
    "doctorName" TEXT,
    "institution" TEXT,
    "specialty" TEXT,
    "products" TEXT,
    "interest" TEXT,
    "objection" TEXT,
    "medicalQuestion" TEXT,
    "documentRequest" TEXT,
    "sponsoringRequest" TEXT,
    "careRequest" TEXT,
    "competitorInfo" TEXT,
    "opportunity" TEXT,
    "qualitySignal" TEXT,
    "nextAction" TEXT,
    "summary" TEXT,
    "aiNotes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldReportAttachment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldReportAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldReport_delegateId_idx" ON "FieldReport"("delegateId");

-- CreateIndex
CREATE INDEX "FieldReport_status_idx" ON "FieldReport"("status");

-- CreateIndex
CREATE INDEX "FieldReport_doctorId_idx" ON "FieldReport"("doctorId");

-- CreateIndex
CREATE INDEX "FieldReport_visitDate_idx" ON "FieldReport"("visitDate");

-- CreateIndex
CREATE INDEX "FieldReportAttachment_reportId_idx" ON "FieldReportAttachment"("reportId");

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldReportAttachment" ADD CONSTRAINT "FieldReportAttachment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FieldReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

