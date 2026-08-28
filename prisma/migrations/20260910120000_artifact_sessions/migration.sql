-- LIVE OFFICE — sessions de document ouvert et journal des opérations (§3, §18).
--
-- Idempotent : la migration se rejoue sans dommage sur une base déjà à jour, comme toutes les
-- migrations manuelles du projet.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArtifactSessionState') THEN
    CREATE TYPE "ArtifactSessionState" AS ENUM (
      'OPENING', 'OPEN', 'EDITING', 'DIRTY', 'SAVING', 'SAVED', 'FAILED', 'CLOSED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ArtifactSession" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "threadId"        TEXT,
  "blockId"         TEXT NOT NULL,
  "nodeId"          TEXT NOT NULL,
  "baseVersion"     INTEGER NOT NULL,
  "name"            TEXT NOT NULL,
  "format"          TEXT NOT NULL,
  "state"           "ArtifactSessionState" NOT NULL DEFAULT 'OPENING',
  "revision"        INTEGER NOT NULL DEFAULT 0,
  "dirty"           BOOLEAN NOT NULL DEFAULT false,
  "savedVersion"    INTEGER,
  "lastError"       TEXT,
  "activePage"      INTEGER,
  "activeSlide"     INTEGER,
  "activeSheet"     TEXT,
  "activeSelection" JSONB,
  "openedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"        TIMESTAMP(3),
  CONSTRAINT "ArtifactSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ArtifactOperation" (
  "id"            TEXT NOT NULL,
  "sessionId"     TEXT NOT NULL,
  "operationId"   TEXT NOT NULL,
  "seq"           INTEGER NOT NULL,
  "beforeVersion" INTEGER NOT NULL,
  "afterVersion"  INTEGER NOT NULL,
  "command"       JSONB NOT NULL,
  "summary"       TEXT NOT NULL,
  "actorId"       TEXT NOT NULL,
  "actorLabel"    TEXT NOT NULL,
  "undone"        BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtifactOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ArtifactSession_userId_state_updatedAt_idx" ON "ArtifactSession" ("userId", "state", "updatedAt");
CREATE INDEX IF NOT EXISTS "ArtifactSession_nodeId_idx" ON "ArtifactSession" ("nodeId");
CREATE INDEX IF NOT EXISTS "ArtifactSession_threadId_idx" ON "ArtifactSession" ("threadId");
CREATE UNIQUE INDEX IF NOT EXISTS "ArtifactOperation_sessionId_operationId_key" ON "ArtifactOperation" ("sessionId", "operationId");
CREATE INDEX IF NOT EXISTS "ArtifactOperation_sessionId_seq_idx" ON "ArtifactOperation" ("sessionId", "seq");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtifactSession_userId_fkey') THEN
    ALTER TABLE "ArtifactSession" ADD CONSTRAINT "ArtifactSession_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtifactSession_nodeId_fkey') THEN
    ALTER TABLE "ArtifactSession" ADD CONSTRAINT "ArtifactSession_nodeId_fkey"
      FOREIGN KEY ("nodeId") REFERENCES "DriveNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ArtifactOperation_sessionId_fkey') THEN
    ALTER TABLE "ArtifactOperation" ADD CONSTRAINT "ArtifactOperation_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "ArtifactSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
