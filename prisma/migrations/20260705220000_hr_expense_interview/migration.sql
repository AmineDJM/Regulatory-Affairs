-- Notes de frais (mois + accusé de réception des originaux) et entrevue RH — idempotent.
ALTER TYPE "HrRequestType" ADD VALUE IF NOT EXISTS 'HR_INTERVIEW';

ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "expenseMonth" TEXT;
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "approvedMonth" TEXT;
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "originalsAckAt" TIMESTAMP(3);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "originalsAckById" TEXT;
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "meetingAt" TIMESTAMP(3);
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "meetingProposedById" TEXT;
ALTER TABLE "HrDocumentRequest" ADD COLUMN IF NOT EXISTS "meetingConfirmedAt" TIMESTAMP(3);
