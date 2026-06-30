-- Accompagnants / délégué de référence + ordre de mission (congrès, événement, sponsoring).

-- Enums
CREATE TYPE "MissionRole" AS ENUM ('ACCOMPAGNANT', 'DELEGATE_REFERENCE');
CREATE TYPE "MissionOrderStatus" AS ENUM ('NONE', 'REQUESTED', 'ISSUED');

-- EntityType : entité événement + entité polymorphe d'assignation (docs/discussions).
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'EVENT';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'MISSION_ASSIGNMENT';

-- DocumentCategory : ordre de mission.
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'MISSION_ORDER';

-- CreateTable
CREATE TABLE "MissionAssignment" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MissionRole" NOT NULL DEFAULT 'ACCOMPAGNANT',
    "orderStatus" "MissionOrderStatus" NOT NULL DEFAULT 'NONE',
    "requestedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "issuedById" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionAssignment_entityType_entityId_userId_key" ON "MissionAssignment"("entityType", "entityId", "userId");

-- CreateIndex
CREATE INDEX "MissionAssignment_userId_idx" ON "MissionAssignment"("userId");

-- CreateIndex
CREATE INDEX "MissionAssignment_entityType_entityId_idx" ON "MissionAssignment"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "MissionAssignment" ADD CONSTRAINT "MissionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
