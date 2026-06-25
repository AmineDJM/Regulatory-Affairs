-- CreateEnum
CREATE TYPE "DriveNodeType" AS ENUM ('FOLDER', 'FILE');

-- CreateEnum
CREATE TYPE "DriveAccess" AS ENUM ('VIEW', 'EDIT');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'DRIVE_NODE';

-- CreateTable
CREATE TABLE "DriveNode" (
    "custom" JSONB,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DriveNodeType" NOT NULL,
    "parentId" TEXT,
    "ownerId" TEXT,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "iv" BYTEA NOT NULL,
    "data" BYTEA NOT NULL,
    "refCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileVersion" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriveShare" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "access" "DriveAccess" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveNode_parentId_idx" ON "DriveNode"("parentId");

-- CreateIndex
CREATE INDEX "DriveNode_ownerId_idx" ON "DriveNode"("ownerId");

-- CreateIndex
CREATE INDEX "DriveNode_isTrashed_idx" ON "DriveNode"("isTrashed");

-- CreateIndex
CREATE UNIQUE INDEX "FileBlob_sha256_key" ON "FileBlob"("sha256");

-- CreateIndex
CREATE INDEX "FileVersion_nodeId_idx" ON "FileVersion"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "FileVersion_nodeId_version_key" ON "FileVersion"("nodeId", "version");

-- CreateIndex
CREATE INDEX "DriveShare_userId_idx" ON "DriveShare"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveShare_nodeId_userId_key" ON "DriveShare"("nodeId", "userId");

-- AddForeignKey
ALTER TABLE "DriveNode" ADD CONSTRAINT "DriveNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DriveNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveNode" ADD CONSTRAINT "DriveNode_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "DriveNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_blobId_fkey" FOREIGN KEY ("blobId") REFERENCES "FileBlob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveShare" ADD CONSTRAINT "DriveShare_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "DriveNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveShare" ADD CONSTRAINT "DriveShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

