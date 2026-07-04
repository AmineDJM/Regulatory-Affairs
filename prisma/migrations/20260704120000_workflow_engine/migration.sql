-- Moteur de workflow configurable (Ad & Pro) : définitions / étapes / instances / événements.
-- Idempotent (CREATE TABLE/INDEX IF NOT EXISTS, contraintes via DO/EXCEPTION).

CREATE TABLE IF NOT EXISTS "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowDefinition_category_key" ON "WorkflowDefinition"("category");

CREATE TABLE IF NOT EXISTS "WorkflowStep" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actorScope" TEXT NOT NULL DEFAULT 'ROLE',
    "powers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignRole" TEXT,
    "requireAmount" BOOLEAN NOT NULL DEFAULT false,
    "requireCategory" BOOLEAN NOT NULL DEFAULT false,
    "requireNote" BOOLEAN NOT NULL DEFAULT false,
    "emitDeclaration" BOOLEAN NOT NULL DEFAULT false,
    "emitExpenseOrder" BOOLEAN NOT NULL DEFAULT false,
    "notifyRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "legacyStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowStep_definitionId_position_key" ON "WorkflowStep"("definitionId","position");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowStep_definitionId_slug_key" ON "WorkflowStep"("definitionId","slug");
CREATE INDEX IF NOT EXISTS "WorkflowStep_definitionId_idx" ON "WorkflowStep"("definitionId");

CREATE TABLE IF NOT EXISTS "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "currentSlug" TEXT,
    "amount" DECIMAL(14,2),
    "budgetCategoryId" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowInstance_entityType_entityId_key" ON "WorkflowInstance"("entityType","entityId");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_category_status_idx" ON "WorkflowInstance"("category","status");

CREATE TABLE IF NOT EXISTS "WorkflowStepEvent" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepSlug" TEXT NOT NULL,
    "stepTitle" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "note" TEXT,
    "amount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowStepEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowStepEvent_instanceId_idx" ON "WorkflowStepEvent"("instanceId");

DO $$ BEGIN
  ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "WorkflowStepEvent" ADD CONSTRAINT "WorkflowStepEvent_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
