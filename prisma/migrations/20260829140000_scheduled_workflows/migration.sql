-- LE PLANIFICATEUR PERSISTANT — deux tables neuves (cf. schema.prisma).
--
-- Idempotente. Elle n'écrit dans AUCUNE table existante : elle ajoute deux tables vides. Aucune
-- planification n'existe tant que quelqu'un n'en a pas créé une, et une planification n'exécute
-- que des traitements DÉCLARÉS dans le registre — jamais du code porté par la ligne elle-même.

CREATE TABLE IF NOT EXISTS "ScheduledWorkflow" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "kind"        TEXT NOT NULL,
  "payload"     JSONB,
  "recurrence"  TEXT NOT NULL,
  "hourLocal"   INTEGER NOT NULL DEFAULT 7,
  "dayOfWeek"   INTEGER,
  "dayOfMonth"  INTEGER,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "nextRunAt"   TIMESTAMP(3) NOT NULL,
  "lastRunAt"   TIMESTAMP(3),
  "claimedAt"   TIMESTAMP(3),
  "ownerId"     TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledWorkflow_pkey" PRIMARY KEY ("id")
);

-- L'index qui porte TOUTE la boucle du planificateur : « quelles planifications sont dues ? »
CREATE INDEX IF NOT EXISTS "ScheduledWorkflow_status_nextRunAt_idx" ON "ScheduledWorkflow"("status", "nextRunAt");
CREATE INDEX IF NOT EXISTS "ScheduledWorkflow_ownerId_idx" ON "ScheduledWorkflow"("ownerId");

CREATE TABLE IF NOT EXISTS "WorkflowRun" (
  "id"         TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status"     TEXT NOT NULL DEFAULT 'OK',
  "summary"    TEXT,
  "error"      TEXT,
  "ms"         INTEGER,
  CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkflowRun_workflowId_startedAt_idx" ON "WorkflowRun"("workflowId", "startedAt");

DO $$ BEGIN
  ALTER TABLE "ScheduledWorkflow"
    ADD CONSTRAINT "ScheduledWorkflow_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowRun"
    ADD CONSTRAINT "WorkflowRun_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "ScheduledWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
