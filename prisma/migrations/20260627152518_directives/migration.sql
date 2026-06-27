-- CreateEnum
CREATE TYPE "DirectiveStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DONE', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE 'DIRECTIVE';

-- CreateTable
CREATE TABLE "Directive" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DirectiveStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "targetUserId" TEXT,
    "targetRole" "UserRole",
    "fromId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Directive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectiveMessage" (
    "id" TEXT NOT NULL,
    "directiveId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DirectiveMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Directive_reference_key" ON "Directive"("reference");

-- CreateIndex
CREATE INDEX "Directive_status_idx" ON "Directive"("status");

-- CreateIndex
CREATE INDEX "Directive_targetUserId_idx" ON "Directive"("targetUserId");

-- CreateIndex
CREATE INDEX "Directive_targetRole_idx" ON "Directive"("targetRole");

-- CreateIndex
CREATE INDEX "Directive_priority_idx" ON "Directive"("priority");

-- CreateIndex
CREATE INDEX "DirectiveMessage_directiveId_idx" ON "DirectiveMessage"("directiveId");

-- AddForeignKey
ALTER TABLE "Directive" ADD CONSTRAINT "Directive_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Directive" ADD CONSTRAINT "Directive_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectiveMessage" ADD CONSTRAINT "DirectiveMessage_directiveId_fkey" FOREIGN KEY ("directiveId") REFERENCES "Directive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectiveMessage" ADD CONSTRAINT "DirectiveMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

