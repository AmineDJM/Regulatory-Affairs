-- Rappels : échelle de relances (« demain, puis +48 h, puis +72 h ») et extinction sur événement.
ALTER TABLE "AssistantReminder" ADD COLUMN IF NOT EXISTS "escalationsH" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AssistantReminder" ADD COLUMN IF NOT EXISTS "stopOnEvent" JSONB;
