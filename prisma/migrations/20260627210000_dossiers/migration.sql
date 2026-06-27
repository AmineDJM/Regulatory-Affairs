-- Dossiers de suivi (sujets délégués/suivis) + fil de discussion.
ALTER TYPE "EntityType" ADD VALUE 'DOSSIER';

CREATE TYPE "DossierStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'DONE', 'ARCHIVED');

CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "DossierStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "assignedToId" TEXT,
    "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Dossier_reference_key" ON "Dossier"("reference");
CREATE INDEX "Dossier_status_idx" ON "Dossier"("status");
CREATE INDEX "Dossier_createdById_idx" ON "Dossier"("createdById");
CREATE INDEX "Dossier_assignedToId_idx" ON "Dossier"("assignedToId");

CREATE TABLE "DossierMessage" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DossierMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DossierMessage_dossierId_idx" ON "DossierMessage"("dossierId");

ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Dossier" ADD CONSTRAINT "Dossier_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DossierMessage" ADD CONSTRAINT "DossierMessage_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DossierMessage" ADD CONSTRAINT "DossierMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
