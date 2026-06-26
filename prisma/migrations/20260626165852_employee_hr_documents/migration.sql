-- CreateEnum
CREATE TYPE "HrDocumentCategory" AS ENUM ('CONTRACT', 'AMENDMENT', 'PAYSLIP', 'WORK_CERTIFICATE', 'CNAS_CERTIFICATE', 'SALARY_STATEMENT', 'DOMICILIATION', 'ID_DOCUMENT', 'DIPLOMA', 'MEDICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "HrRequestType" AS ENUM ('WORK_CERTIFICATE', 'CNAS_CERTIFICATE', 'SALARY_STATEMENT', 'DOMICILIATION', 'LEAVE_CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "HrRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'READY', 'DELIVERED', 'REJECTED');

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" "HrDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "period" TEXT,
    "visibleToEmployee" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrDocumentRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "HrRequestType" NOT NULL DEFAULT 'WORK_CERTIFICATE',
    "status" "HrRequestStatus" NOT NULL DEFAULT 'PENDING',
    "details" TEXT,
    "hrNote" TEXT,
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrDocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDocument_requestId_key" ON "EmployeeDocument"("requestId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_category_idx" ON "EmployeeDocument"("category");

-- CreateIndex
CREATE INDEX "HrDocumentRequest_employeeId_idx" ON "HrDocumentRequest"("employeeId");

-- CreateIndex
CREATE INDEX "HrDocumentRequest_status_idx" ON "HrDocumentRequest"("status");

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HrDocumentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrDocumentRequest" ADD CONSTRAINT "HrDocumentRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

