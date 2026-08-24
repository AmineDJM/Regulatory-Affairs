-- LES RAPPELS DU CHIEF OF STAFF — « rappelle-moi mardi à 10 h », « tous les dimanches relance
-- Regulatory ». Un rappel appartient à UNE personne ; à l'échéance il la prévient (pop-up), et
-- s'il porte un rôle cible, il relance AUSSI ce rôle avec la note. Les récurrences avancent leur
-- échéance et restent actives ; un rappel simple s'éteint après le premier tir.

CREATE TABLE IF NOT EXISTS "AssistantReminder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "note" TEXT,
  "link" TEXT,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "recurrence" TEXT NOT NULL DEFAULT 'NONE',
  "targetRole" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssistantReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantReminder_active_dueAt_idx" ON "AssistantReminder"("active", "dueAt");
CREATE INDEX IF NOT EXISTS "AssistantReminder_userId_idx" ON "AssistantReminder"("userId");

DO $$ BEGIN
  ALTER TABLE "AssistantReminder" ADD CONSTRAINT "AssistantReminder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
