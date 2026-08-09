-- Typologie des réserves ANPP + structure CTD des points. Idempotent.
ALTER TABLE "RegulatoryReserveCycle" ADD COLUMN IF NOT EXISTS "reserveType" TEXT;
ALTER TABLE "RegulatoryReservePoint" ADD COLUMN IF NOT EXISTS "sectionCode" TEXT;
ALTER TABLE "RegulatoryReservePoint" ADD COLUMN IF NOT EXISTS "subject" TEXT;
