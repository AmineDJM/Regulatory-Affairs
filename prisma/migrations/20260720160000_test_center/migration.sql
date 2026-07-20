-- Adventum Autonomous Test Center — run tracking, manifeste de nettoyage, findings.
-- Idempotent (rejouable) : enums via DO/EXCEPTION, tables IF NOT EXISTS, FK gardées.

DO $$ BEGIN CREATE TYPE "TestRunMode" AS ENUM ('READ_ONLY_AUDIT','SAFE_SYNTHETIC_TEST','STAGING_FULL_TEST','CHAOS_TEST','SECURITY_AUDIT','PERFORMANCE_BENCHMARK'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TestRunStatus" AS ENUM ('PENDING','RUNNING','PASSED','FAILED','ABORTED','CLEANUP_INCOMPLETE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TestCleanupStatus" AS ENUM ('NOT_REQUIRED','PENDING','RUNNING','DONE','INCOMPLETE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "TestSeverity" AS ENUM ('CRITICAL','HIGH','MEDIUM','LOW','INFO'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "TestRun" (
  "id"               TEXT NOT NULL,
  "mode"             "TestRunMode" NOT NULL DEFAULT 'SAFE_SYNTHETIC_TEST',
  "environment"      TEXT NOT NULL DEFAULT 'unknown',
  "status"           "TestRunStatus" NOT NULL DEFAULT 'PENDING',
  "cleanupStatus"    "TestCleanupStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "initiatedById"    TEXT NOT NULL,
  "gitCommit"        TEXT,
  "gitBranch"        TEXT,
  "config"           JSONB,
  "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"       TIMESTAMP(3),
  "progress"         INTEGER NOT NULL DEFAULT 0,
  "step"             TEXT,
  "score"            INTEGER,
  "criticalCount"    INTEGER NOT NULL DEFAULT 0,
  "findingsCount"    INTEGER NOT NULL DEFAULT 0,
  "resourcesCreated" INTEGER NOT NULL DEFAULT 0,
  "resourcesDeleted" INTEGER NOT NULL DEFAULT 0,
  "summary"          JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TestRun_status_startedAt_idx" ON "TestRun"("status","startedAt");

CREATE TABLE IF NOT EXISTS "TestArtifact" (
  "id"            TEXT NOT NULL,
  "testRunId"     TEXT NOT NULL,
  "resourceType"  TEXT NOT NULL,
  "model"         TEXT,
  "recordId"      TEXT NOT NULL,
  "blobKey"       TEXT,
  "dependsOn"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "deleteMethod"  TEXT NOT NULL DEFAULT 'prisma',
  "deletedAt"     TIMESTAMP(3),
  "cleanupResult" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestArtifact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TestArtifact_testRunId_idx" ON "TestArtifact"("testRunId");
CREATE INDEX IF NOT EXISTS "TestArtifact_testRunId_deletedAt_idx" ON "TestArtifact"("testRunId","deletedAt");
DO $$ BEGIN
  ALTER TABLE "TestArtifact" ADD CONSTRAINT "TestArtifact_testRunId_fkey"
    FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "TestFinding" (
  "id"         TEXT NOT NULL,
  "testRunId"  TEXT NOT NULL,
  "severity"   "TestSeverity" NOT NULL DEFAULT 'INFO',
  "category"   TEXT NOT NULL,
  "module"     TEXT,
  "route"      TEXT,
  "roleTested" TEXT,
  "title"      TEXT NOT NULL,
  "detail"     TEXT NOT NULL,
  "evidence"   JSONB,
  "suggestion" TEXT,
  "confidence" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TestFinding_testRunId_severity_idx" ON "TestFinding"("testRunId","severity");
DO $$ BEGIN
  ALTER TABLE "TestFinding" ADD CONSTRAINT "TestFinding_testRunId_fkey"
    FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
