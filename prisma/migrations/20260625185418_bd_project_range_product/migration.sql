-- CreateEnum
CREATE TYPE "BdProjectStatus" AS ENUM ('IDEA', 'TO_ANALYZE', 'IN_PROGRESS', 'AWAITING_SUPPLIER', 'AWAITING_INTERNAL', 'RECOMMENDATION_READY', 'VALIDATED', 'ABANDONED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BdSourcing" AS ENUM ('MANUFACTURED', 'IMPORTED', 'TO_STUDY');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'BD_PROJECT';

-- CreateTable
CREATE TABLE "BdProject" (
    "custom" JSONB,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BdProjectStatus" NOT NULL DEFAULT 'IDEA',
    "description" TEXT,
    "comment" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BdProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BdRange" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comment" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BdRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BdProduct" (
    "custom" JSONB,
    "id" TEXT NOT NULL,
    "dci" TEXT NOT NULL,
    "brandName" TEXT,
    "dosage" TEXT,
    "form" TEXT,
    "sourcing" "BdSourcing" NOT NULL DEFAULT 'TO_STUDY',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "marketSizeDzd" DECIMAL(18,2),
    "marketSizeUsd" DECIMAL(18,2),
    "unitPrice" DECIMAL(14,2),
    "totalMarketVolume" DECIMAL(18,2),
    "competitors" TEXT,
    "competitorShares" TEXT,
    "competitorVolume" TEXT,
    "competitorPrice" TEXT,
    "investmentY1" DECIMAL(18,2),
    "investmentY2" DECIMAL(18,2),
    "investmentY3" DECIMAL(18,2),
    "revenueY1" DECIMAL(18,2),
    "revenueY2" DECIMAL(18,2),
    "revenueY3" DECIMAL(18,2),
    "comment" TEXT,
    "rangeId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BdProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BdProject_status_idx" ON "BdProject"("status");

-- CreateIndex
CREATE INDEX "BdProject_ownerId_idx" ON "BdProject"("ownerId");

-- CreateIndex
CREATE INDEX "BdRange_projectId_idx" ON "BdRange"("projectId");

-- CreateIndex
CREATE INDEX "BdProduct_rangeId_idx" ON "BdProduct"("rangeId");

-- AddForeignKey
ALTER TABLE "BdProject" ADD CONSTRAINT "BdProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdRange" ADD CONSTRAINT "BdRange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BdProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BdProduct" ADD CONSTRAINT "BdProduct_rangeId_fkey" FOREIGN KEY ("rangeId") REFERENCES "BdRange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

