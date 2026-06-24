-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'DIRECTION', 'HEAD_OF_REGULATORY', 'REGULATORY_ASSISTANT', 'HEAD_OF_SALES', 'SALES_USER', 'LOGISTICS_MANAGER', 'MEDICAL_PROMOTION_MANAGER', 'MEDICAL_DELEGATE', 'BUSINESS_DEVELOPMENT_MANAGER', 'FINANCE_BUDGET_MANAGER', 'VIEWER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('IMPORTED', 'LOCALLY_MANUFACTURED', 'TOLL_MANUFACTURING', 'BIOSIMILAR', 'GENERIC', 'ORIGINATOR');

-- CreateEnum
CREATE TYPE "RegulatoryStatus" AS ENUM ('PRE_SUBMISSION', 'IN_PREPARATION', 'SUBMITTED', 'AWAITING_BV_PAYMENT', 'AWAITING_ANPP', 'RESPONDING_TO_QUERIES', 'DECISION_OBTAINED', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'LATE');

-- CreateEnum
CREATE TYPE "RegulatoryStepType" AS ENUM ('PRE_SUBMISSION', 'CTD_PREPARATION', 'DOSSIER_REVIEW', 'DOSSIER_SUBMISSION', 'BV1_PAYMENT', 'BV1_RECEIPT', 'BV2_PAYMENT', 'BV2_RECEIPT', 'BV3_PAYMENT', 'BV3_RECEIPT', 'QUERY_RESPONSE', 'COMPLEMENTS_REQUESTED', 'COMPLEMENTS_SUBMITTED', 'COMMISSION_REVIEW', 'REGISTRATION_DECISION', 'AMM_RECEIVED', 'DOSSIER_CLOSED');

-- CreateEnum
CREATE TYPE "SponsoringStatus" AS ENUM ('RECEIVED', 'IN_ANALYSIS', 'ACCEPTED', 'REFUSED', 'AWAITING_DIRECTION', 'PAID', 'CLOSED');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('REGULATORY', 'SPONSORING', 'CONGRESS_INTERNATIONAL', 'CONGRESS_NATIONAL', 'MEDICAL_PROMOTION', 'LOGISTICS', 'BUSINESS_DEVELOPMENT', 'MARKETING');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'OVER_BUDGET', 'CLOSED');

-- CreateEnum
CREATE TYPE "CongressStatus" AS ENUM ('CONSIDERED', 'VALIDATED', 'ORGANIZED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'RETURNED');

-- CreateEnum
CREATE TYPE "LogisticsStatus" AS ENUM ('ORDERED', 'PRODUCTION', 'SHIPPED', 'ARRIVED_TERMINAL', 'CUSTOMS', 'DELIVERED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "InfluenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'KEY_OPINION_LEADER');

-- CreateEnum
CREATE TYPE "BDType" AS ENUM ('GENERIC', 'BIOSIMILAR', 'ORIGINATOR', 'LICENSE', 'DISTRIBUTION', 'TOLL_MANUFACTURING');

-- CreateEnum
CREATE TYPE "BDStatus" AS ENUM ('IDEA', 'RESEARCH', 'CONTACTED', 'NDA', 'OFFER_RECEIVED', 'NEGOTIATION', 'VALIDATED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('REGULATORY_PRODUCT', 'REGULATORY_STEP', 'SPONSORING', 'BUDGET', 'CONGRESS_INTERNATIONAL', 'CONGRESS_NATIONAL', 'SALE', 'LOGISTICS', 'DOCTOR', 'VISIT', 'DELEGATE_PLAN', 'BD_OPPORTUNITY');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('CTD_FULL', 'MODULE_1', 'MODULE_2', 'MODULE_3', 'MODULE_4', 'MODULE_5', 'GMP_CERTIFICATE', 'CPP', 'ORIGIN_AMM', 'SUBMISSION_LETTER', 'BV_RECEIPT', 'QUERY_RESPONSE', 'REGISTRATION_DECISION', 'PROFORMA', 'INVOICE', 'PACKING_LIST', 'BL_AWB', 'ANALYSIS_CERTIFICATE', 'ORIGIN_CERTIFICATE', 'CUSTOMS_DOCS', 'DELIVERY_NOTE', 'RECEPTION_REPORT', 'REQUEST_LETTER', 'PROGRAM', 'QUOTE', 'CONVENTION', 'SUPPORTING_DOC', 'PHOTO', 'PRESENTATION', 'POST_EVENT_REPORT', 'SUPPLIER_OFFER', 'OTHER');

-- CreateEnum
CREATE TYPE "Confidentiality" AS ENUM ('INTERNAL', 'RESTRICTED', 'CONFIDENTIAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DEADLINE_NEAR', 'LATE', 'ASSIGNMENT', 'DOCUMENT_UPLOADED', 'VALIDATION_REQUIRED', 'BUDGET_EXCEEDED', 'PCH_DELAY', 'REGULATORY_BLOCKED', 'SPONSORING_VALIDATION', 'BD_NEXT_ACTION', 'MEDICAL_TOUR', 'GENERIC');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'UPLOAD', 'VALIDATE', 'REFUSE');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "title" TEXT,
    "phone" TEXT,
    "avatarColor" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "region" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryProduct" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dci" TEXT NOT NULL,
    "brandName" TEXT,
    "dosage" TEXT,
    "pharmaceuticalForm" TEXT,
    "therapeuticClass" TEXT,
    "partnerLab" TEXT,
    "countryOfOrigin" TEXT,
    "productType" "ProductType" NOT NULL DEFAULT 'IMPORTED',
    "status" "RegulatoryStatus" NOT NULL DEFAULT 'PRE_SUBMISSION',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "targetDate" TIMESTAMP(3),
    "comments" TEXT,
    "responsibleId" TEXT,
    "assistantId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryStep" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "RegulatoryStepType" NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "responsible" TEXT,
    "comment" TEXT,
    "missingDocs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegulatoryStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsoringRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requesterId" TEXT,
    "institution" TEXT NOT NULL,
    "doctor" TEXT,
    "specialty" TEXT,
    "city" TEXT,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "amountRequested" DECIMAL(12,2),
    "amountProposed" DECIMAL(12,2),
    "amountGranted" DECIMAL(12,2),
    "status" "SponsoringStatus" NOT NULL DEFAULT 'RECEIVED',
    "strategicImportance" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "product" TEXT,
    "expectedRoi" TEXT,
    "finalDecision" TEXT,
    "validatedBy" TEXT,
    "validationDate" TIMESTAMP(3),
    "comments" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsoringRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "department" "BudgetCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "initialBudget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "consumedBudget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "futureCommitted" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "BudgetStatus" NOT NULL DEFAULT 'ON_TRACK',
    "comments" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CongressInternational" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "specialty" TEXT,
    "participants" TEXT,
    "invitedDoctors" TEXT,
    "products" TEXT,
    "plannedBudget" DECIMAL(14,2),
    "actualBudget" DECIMAL(14,2),
    "status" "CongressStatus" NOT NULL DEFAULT 'CONSIDERED',
    "hotel" TEXT,
    "flight" TEXT,
    "visa" TEXT,
    "registration" TEXT,
    "linkedSponsoring" TEXT,
    "postEventReport" TEXT,
    "generatedLeads" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CongressInternational_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CongressNational" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "hostInstitution" TEXT,
    "date" TIMESTAMP(3),
    "specialty" TEXT,
    "presentDoctors" TEXT,
    "promotedProducts" TEXT,
    "budget" DECIMAL(14,2),
    "hasBooth" BOOLEAN NOT NULL DEFAULT false,
    "hasSymposium" BOOLEAN NOT NULL DEFAULT false,
    "linkedSponsoring" TEXT,
    "presentDelegates" TEXT,
    "status" "CongressStatus" NOT NULL DEFAULT 'CONSIDERED',
    "finalReport" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CongressNational_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product" TEXT NOT NULL,
    "dci" TEXT,
    "dosage" TEXT,
    "pharmaceuticalForm" TEXT,
    "client" TEXT NOT NULL,
    "institution" TEXT,
    "isPch" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estimatedMargin" DECIMAL(14,2),
    "purchaseOrder" TEXT,
    "invoice" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "salesUserId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "dci" TEXT,
    "dosage" TEXT,
    "pharmaceuticalForm" TEXT,
    "supplier" TEXT,
    "country" TEXT,
    "quantityOrdered" INTEGER NOT NULL DEFAULT 0,
    "quantityReceived" INTEGER NOT NULL DEFAULT 0,
    "quantityDelivered" INTEGER NOT NULL DEFAULT 0,
    "orderDate" TIMESTAMP(3),
    "estimatedDeparture" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "customsDate" TIMESTAMP(3),
    "pchDeliveryDate" TIMESTAMP(3),
    "status" "LogisticsStatus" NOT NULL DEFAULT 'ORDERED',
    "carrier" TEXT,
    "incoterm" TEXT,
    "invoiceNumber" TEXT,
    "blAwbNumber" TEXT,
    "orderValue" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "exchangeRate" DECIMAL(10,4),
    "comments" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalDoctor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "institution" TEXT,
    "city" TEXT,
    "region" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "influenceLevel" "InfluenceLevel" NOT NULL DEFAULT 'MEDIUM',
    "prescriptionPotential" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "targetProducts" TEXT,
    "lastVisit" TIMESTAMP(3),
    "nextVisit" TIMESTAMP(3),
    "comments" TEXT,
    "delegateId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalVisit" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "doctorId" TEXT,
    "delegateId" TEXT,
    "region" TEXT,
    "objective" TEXT,
    "presentedProducts" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'PLANNED',
    "report" TEXT,
    "doctorFeedback" TEXT,
    "followUpActions" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalDelegatePlan" (
    "id" TEXT NOT NULL,
    "delegateId" TEXT,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "region" TEXT,
    "visitsTarget" INTEGER NOT NULL DEFAULT 0,
    "keyDoctorsTarget" INTEGER NOT NULL DEFAULT 0,
    "productTarget" TEXT,
    "achievedVisits" INTEGER NOT NULL DEFAULT 0,
    "managerComment" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalDelegatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDevelopmentOpportunity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dci" TEXT,
    "therapeuticClass" TEXT,
    "type" "BDType" NOT NULL DEFAULT 'GENERIC',
    "targetMarket" TEXT,
    "estimatedMarketSize" DECIMAL(16,2),
    "estimatedPrice" DECIMAL(12,2),
    "competitors" TEXT,
    "potentialSupplier" TEXT,
    "supplierCountry" TEXT,
    "supplierContact" TEXT,
    "status" "BDStatus" NOT NULL DEFAULT 'IDEA',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "score" INTEGER,
    "nextAction" TEXT,
    "nextActionDate" TIMESTAMP(3),
    "comments" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessDevelopmentOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "confidentiality" "Confidentiality" NOT NULL DEFAULT 'INTERNAL',
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERIC',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" "EntityType",
    "entityId" TEXT,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "summary" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RegulatoryAssignedUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryProduct_reference_key" ON "RegulatoryProduct"("reference");

-- CreateIndex
CREATE INDEX "RegulatoryProduct_status_idx" ON "RegulatoryProduct"("status");

-- CreateIndex
CREATE INDEX "RegulatoryProduct_priority_idx" ON "RegulatoryProduct"("priority");

-- CreateIndex
CREATE INDEX "RegulatoryProduct_responsibleId_idx" ON "RegulatoryProduct"("responsibleId");

-- CreateIndex
CREATE INDEX "RegulatoryProduct_assistantId_idx" ON "RegulatoryProduct"("assistantId");

-- CreateIndex
CREATE INDEX "RegulatoryProduct_dci_idx" ON "RegulatoryProduct"("dci");

-- CreateIndex
CREATE INDEX "RegulatoryStep_productId_idx" ON "RegulatoryStep"("productId");

-- CreateIndex
CREATE INDEX "RegulatoryStep_status_idx" ON "RegulatoryStep"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RegulatoryStep_productId_type_key" ON "RegulatoryStep"("productId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "SponsoringRequest_reference_key" ON "SponsoringRequest"("reference");

-- CreateIndex
CREATE INDEX "SponsoringRequest_status_idx" ON "SponsoringRequest"("status");

-- CreateIndex
CREATE INDEX "SponsoringRequest_strategicImportance_idx" ON "SponsoringRequest"("strategicImportance");

-- CreateIndex
CREATE INDEX "SponsoringRequest_requesterId_idx" ON "SponsoringRequest"("requesterId");

-- CreateIndex
CREATE INDEX "BudgetLine_year_idx" ON "BudgetLine"("year");

-- CreateIndex
CREATE INDEX "BudgetLine_department_idx" ON "BudgetLine"("department");

-- CreateIndex
CREATE INDEX "BudgetLine_status_idx" ON "BudgetLine"("status");

-- CreateIndex
CREATE INDEX "CongressInternational_status_idx" ON "CongressInternational"("status");

-- CreateIndex
CREATE INDEX "CongressInternational_startDate_idx" ON "CongressInternational"("startDate");

-- CreateIndex
CREATE INDEX "CongressNational_status_idx" ON "CongressNational"("status");

-- CreateIndex
CREATE INDEX "CongressNational_date_idx" ON "CongressNational"("date");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");

-- CreateIndex
CREATE INDEX "Sale_product_idx" ON "Sale"("product");

-- CreateIndex
CREATE INDEX "Sale_client_idx" ON "Sale"("client");

-- CreateIndex
CREATE INDEX "Sale_salesUserId_idx" ON "Sale"("salesUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LogisticsOrder_reference_key" ON "LogisticsOrder"("reference");

-- CreateIndex
CREATE INDEX "LogisticsOrder_status_idx" ON "LogisticsOrder"("status");

-- CreateIndex
CREATE INDEX "LogisticsOrder_estimatedArrival_idx" ON "LogisticsOrder"("estimatedArrival");

-- CreateIndex
CREATE INDEX "LogisticsOrder_supplier_idx" ON "LogisticsOrder"("supplier");

-- CreateIndex
CREATE INDEX "MedicalDoctor_delegateId_idx" ON "MedicalDoctor"("delegateId");

-- CreateIndex
CREATE INDEX "MedicalDoctor_region_idx" ON "MedicalDoctor"("region");

-- CreateIndex
CREATE INDEX "MedicalDoctor_city_idx" ON "MedicalDoctor"("city");

-- CreateIndex
CREATE INDEX "MedicalVisit_delegateId_idx" ON "MedicalVisit"("delegateId");

-- CreateIndex
CREATE INDEX "MedicalVisit_doctorId_idx" ON "MedicalVisit"("doctorId");

-- CreateIndex
CREATE INDEX "MedicalVisit_status_idx" ON "MedicalVisit"("status");

-- CreateIndex
CREATE INDEX "MedicalVisit_date_idx" ON "MedicalVisit"("date");

-- CreateIndex
CREATE INDEX "MedicalDelegatePlan_delegateId_idx" ON "MedicalDelegatePlan"("delegateId");

-- CreateIndex
CREATE INDEX "MedicalDelegatePlan_weekStart_idx" ON "MedicalDelegatePlan"("weekStart");

-- CreateIndex
CREATE INDEX "BusinessDevelopmentOpportunity_status_idx" ON "BusinessDevelopmentOpportunity"("status");

-- CreateIndex
CREATE INDEX "BusinessDevelopmentOpportunity_priority_idx" ON "BusinessDevelopmentOpportunity"("priority");

-- CreateIndex
CREATE INDEX "BusinessDevelopmentOpportunity_ownerId_idx" ON "BusinessDevelopmentOpportunity"("ownerId");

-- CreateIndex
CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "Comment_entityType_entityId_idx" ON "Comment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_RegulatoryAssignedUsers_AB_unique" ON "_RegulatoryAssignedUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_RegulatoryAssignedUsers_B_index" ON "_RegulatoryAssignedUsers"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryProduct" ADD CONSTRAINT "RegulatoryProduct_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryProduct" ADD CONSTRAINT "RegulatoryProduct_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegulatoryStep" ADD CONSTRAINT "RegulatoryStep_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RegulatoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoringRequest" ADD CONSTRAINT "SponsoringRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_salesUserId_fkey" FOREIGN KEY ("salesUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsOrder" ADD CONSTRAINT "LogisticsOrder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDoctor" ADD CONSTRAINT "MedicalDoctor_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalVisit" ADD CONSTRAINT "MedicalVisit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalVisit" ADD CONSTRAINT "MedicalVisit_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalDelegatePlan" ADD CONSTRAINT "MedicalDelegatePlan_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDevelopmentOpportunity" ADD CONSTRAINT "BusinessDevelopmentOpportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RegulatoryAssignedUsers" ADD CONSTRAINT "_RegulatoryAssignedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "RegulatoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RegulatoryAssignedUsers" ADD CONSTRAINT "_RegulatoryAssignedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
