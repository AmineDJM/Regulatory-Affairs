-- Nouveau pôle « Matériel promotionnel » : entité, statuts du workflow et
-- catégories de documents associées.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PROMO_MATERIAL';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'PURCHASE_ORDER';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'PAYMENT_SLIP';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIPT';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'PROMO_MATERIAL_FILE';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'AD_VISA';

CREATE TYPE "PromoMaterialStatus" AS ENUM (
  'PROSPECTION_REQUESTED', 'QUOTES_UPLOADED', 'AGENCY_CHOSEN', 'BC_FINANCE_REVIEW',
  'BC_VALIDATED', 'BC_SENT', 'PAYMENT_INITIATED', 'PAYMENT_DONE', 'MATERIAL_PRODUCED',
  'CONFORMITY_REVIEW', 'VISA_OBTAINED', 'BAT_PRINTING', 'FINAL_MATERIAL', 'INVOICED',
  'SETTLED', 'CANCELLED'
);

CREATE TABLE "PromoMaterial" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "PromoMaterialStatus" NOT NULL DEFAULT 'PROSPECTION_REQUESTED',
  "requesterId" TEXT,
  "assistantId" TEXT,
  "chosenAgency" TEXT,
  "chosenAmount" DECIMAL(14,2),
  "amount" DECIMAL(14,2),
  "bcReference" TEXT,
  "visaReference" TEXT,
  "authorityRef" TEXT,
  "bcValidatedAt" TIMESTAMP(3),
  "paymentInitiatedAt" TIMESTAMP(3),
  "paymentDoneAt" TIMESTAMP(3),
  "financeReminderAt" TIMESTAMP(3),
  "financeReminderCount" INTEGER NOT NULL DEFAULT 0,
  "paymentOrderId" TEXT,
  "settlementOrderId" TEXT,
  "adminRequestId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoMaterial_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoMaterial_reference_key" ON "PromoMaterial"("reference");
CREATE INDEX "PromoMaterial_status_idx" ON "PromoMaterial"("status");
CREATE INDEX "PromoMaterial_requesterId_idx" ON "PromoMaterial"("requesterId");
CREATE INDEX "PromoMaterial_assistantId_idx" ON "PromoMaterial"("assistantId");
