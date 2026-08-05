-- MÉMOIRE DE L'ASSISTANT, strictement personnelle et cloisonnée.
-- Chaque fil et chaque message portent leur propriétaire ; aucune lecture n'est possible
-- sans le userId (voir src/lib/assistant-memory.ts). Idempotent — sûr à rejouer.

CREATE TABLE IF NOT EXISTS "AssistantThread" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "title"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantMessage" (
  "id"        TEXT NOT NULL,
  "threadId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "role"      TEXT NOT NULL,
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssistantMemory" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "summary"   TEXT NOT NULL,
  "turns"     INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantThread_userId_updatedAt_idx" ON "AssistantThread"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "AssistantMessage_threadId_createdAt_idx" ON "AssistantMessage"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantMessage_userId_idx" ON "AssistantMessage"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AssistantMemory_userId_key" ON "AssistantMemory"("userId");
CREATE INDEX IF NOT EXISTS "AssistantMemory_userId_idx" ON "AssistantMemory"("userId");

DO $$ BEGIN
  ALTER TABLE "AssistantThread" ADD CONSTRAINT "AssistantThread_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_threadId_fkey"
    FOREIGN KEY ("threadId") REFERENCES "AssistantThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AssistantMemory" ADD CONSTRAINT "AssistantMemory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
