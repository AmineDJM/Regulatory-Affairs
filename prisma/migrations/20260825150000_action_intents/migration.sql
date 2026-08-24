-- ACTION INTENT — l'état canonique serveur de chaque action proposée par l'assistant.
-- Machine d'état unique (PROPOSED → CONFIRMED → EXECUTING → EXECUTED / FAILED / CANCELLED /
-- EXPIRED) : la mémoire (« je te l'avais déjà demandé ? ») et la cohérence UI/voix
-- (« c'est envoyé ? ») se lisent ici. Idempotent : rejouable sans effet sur une base à niveau.

CREATE TABLE IF NOT EXISTS "AssistantActionIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "origin" TEXT NOT NULL DEFAULT 'text',
    "level" TEXT,
    "resultMessage" TEXT,
    "resultLink" TEXT,
    "error" TEXT,
    "events" JSONB NOT NULL DEFAULT '[]',
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "AssistantActionIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantActionIntent_userId_proposedAt_idx" ON "AssistantActionIntent"("userId", "proposedAt");
CREATE INDEX IF NOT EXISTS "AssistantActionIntent_userId_status_idx" ON "AssistantActionIntent"("userId", "status");

DO $$ BEGIN
    ALTER TABLE "AssistantActionIntent"
        ADD CONSTRAINT "AssistantActionIntent_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
