-- Rappels du Chief of Staff : relance d'une PERSONNE NOMMÉE (« tous les dimanches relance
-- Nesrine »), en plus (ou à la place) du rôle. Idempotent.
ALTER TABLE "AssistantReminder" ADD COLUMN IF NOT EXISTS "targetUserId" TEXT;
CREATE INDEX IF NOT EXISTS "AssistantReminder_targetUserId_idx" ON "AssistantReminder"("targetUserId");
DO $$
BEGIN
  ALTER TABLE "AssistantReminder"
    ADD CONSTRAINT "AssistantReminder_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
