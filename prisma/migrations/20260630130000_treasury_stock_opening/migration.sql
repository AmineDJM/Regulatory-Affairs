-- Solde d'ouverture de trésorerie (par compte) + stock initial PCH (par produit/lieu).

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "openingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccount_name_key" ON "TreasuryAccount"("name");

-- CreateTable
CREATE TABLE "StockOpeningLevel" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "product" TEXT NOT NULL,
    "dci" TEXT,
    "location" TEXT NOT NULL DEFAULT 'PCH',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockOpeningLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockOpeningLevel_productId_idx" ON "StockOpeningLevel"("productId");

-- CreateIndex
CREATE INDEX "StockOpeningLevel_location_idx" ON "StockOpeningLevel"("location");
