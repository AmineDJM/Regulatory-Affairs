-- CreateEnum
CREATE TYPE "PchTenderStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PchOrderStatus" AS ENUM ('PENDING', 'VALIDATED', 'DELIVERED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockDirection" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateTable
CREATE TABLE "PchTender" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT,
    "products" TEXT,
    "supplier" TEXT,
    "supplierCountry" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "value" DECIMAL(16,2),
    "client" TEXT NOT NULL DEFAULT 'PCH',
    "status" "PchTenderStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "awardDate" TIMESTAMP(3),
    "cautionAmount" DECIMAL(14,2),
    "cautionDeposited" BOOLEAN NOT NULL DEFAULT false,
    "cautionStart" TIMESTAMP(3),
    "cautionEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PchTender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PchOrder" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "reference" TEXT,
    "products" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "value" DECIMAL(16,2),
    "status" "PchOrderStatus" NOT NULL DEFAULT 'PENDING',
    "receivedDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PchOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "dci" TEXT,
    "direction" "StockDirection" NOT NULL DEFAULT 'IN',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT NOT NULL DEFAULT 'PCH',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PchTender_reference_key" ON "PchTender"("reference");

-- CreateIndex
CREATE INDEX "PchTender_status_idx" ON "PchTender"("status");

-- CreateIndex
CREATE INDEX "PchOrder_tenderId_idx" ON "PchOrder"("tenderId");

-- CreateIndex
CREATE INDEX "StockMovement_product_idx" ON "StockMovement"("product");

-- CreateIndex
CREATE INDEX "StockMovement_date_idx" ON "StockMovement"("date");

-- AddForeignKey
ALTER TABLE "PchOrder" ADD CONSTRAINT "PchOrder_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "PchTender"("id") ON DELETE CASCADE ON UPDATE CASCADE;

