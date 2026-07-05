-- Suivi de stock par états datés : annexes PCH + snapshots (PCH / hôpital / annexe).
CREATE TABLE IF NOT EXISTS "StockAnnex" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockAnnex_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StockAnnex_name_key" ON "StockAnnex"("name");

CREATE TABLE IF NOT EXISTS "StockSnapshot" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "annexId" TEXT,
    "productId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StockSnapshot_productId_scope_annexId_date_idx" ON "StockSnapshot"("productId","scope","annexId","date");

DO $$ BEGIN
  ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_annexId_fkey" FOREIGN KEY ("annexId") REFERENCES "StockAnnex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "RegulatoryProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
