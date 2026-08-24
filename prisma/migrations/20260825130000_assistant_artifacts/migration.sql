-- Registre des LIVRABLES de l'assistant (Word / Excel / PowerPoint) : la spec structurée est
-- conservée pour re-générer, décliner et versionner. Idempotent.

CREATE TABLE IF NOT EXISTS "AssistantArtifact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "formats" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "files" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantArtifact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantArtifact_ownerId_updatedAt_idx" ON "AssistantArtifact"("ownerId", "updatedAt");

DO $$ BEGIN
    ALTER TABLE "AssistantArtifact"
        ADD CONSTRAINT "AssistantArtifact_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
