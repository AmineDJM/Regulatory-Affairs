-- Mémoire exécutive du Chief of Staff : fil principal, mémoire typée, décisions, engagements.
-- Idempotent : rejouable sans effet sur une base déjà à niveau.

-- LE FIL PRINCIPAL — une conversation continue par personne (les autres fils restent possibles).
ALTER TABLE "AssistantThread" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "AssistantThread_userId_isPrimary_idx" ON "AssistantThread"("userId", "isPrimary");

-- MÉMOIRE TYPÉE — ce que l'assistant retient durablement (préférences, alias, principes).
-- Jamais la source de vérité d'une donnée métier.
CREATE TABLE IF NOT EXISTS "AssistantMemoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "structuredData" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "sourceThreadId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantMemoryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantMemoryItem_userId_active_idx" ON "AssistantMemoryItem"("userId", "active");
CREATE INDEX IF NOT EXISTS "AssistantMemoryItem_userId_type_idx" ON "AssistantMemoryItem"("userId", "type");

DO $$ BEGIN
    ALTER TABLE "AssistantMemoryItem"
        ADD CONSTRAINT "AssistantMemoryItem_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- REGISTRE DES DÉCISIONS — enregistrer une décision n'exécute jamais ses conséquences.
CREATE TABLE IF NOT EXISTS "ExecutiveDecision" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT,
    "problem" TEXT,
    "options" JSONB,
    "recommendation" TEXT,
    "decision" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DECIDED',
    "decidedAt" TIMESTAMP(3),
    "expectedOutcome" TEXT,
    "reviewDate" TIMESTAMP(3),
    "actualOutcome" TEXT,
    "lessonsLearned" TEXT,
    "entities" JSONB,
    "sourceThreadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveDecision_ownerId_status_idx" ON "ExecutiveDecision"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "ExecutiveDecision_reviewDate_idx" ON "ExecutiveDecision"("reviewDate");

DO $$ BEGIN
    ALTER TABLE "ExecutiveDecision"
        ADD CONSTRAINT "ExecutiveDecision_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ENGAGEMENTS — un retard se VOIT (alerte au propriétaire), il ne déclenche rien tout seul.
CREATE TABLE IF NOT EXISTS "ExecutiveCommitment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "who" TEXT NOT NULL,
    "toWhom" TEXT,
    "what" TEXT NOT NULL,
    "relatedEntity" TEXT,
    "relatedRef" TEXT,
    "promisedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutiveCommitment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExecutiveCommitment_ownerId_status_idx" ON "ExecutiveCommitment"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "ExecutiveCommitment_dueAt_idx" ON "ExecutiveCommitment"("dueAt");

DO $$ BEGIN
    ALTER TABLE "ExecutiveCommitment"
        ADD CONSTRAINT "ExecutiveCommitment_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
