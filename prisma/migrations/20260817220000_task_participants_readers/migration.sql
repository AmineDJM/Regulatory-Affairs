-- Participants et lecteurs d'une tâche (fixés à la création).
-- Idempotent : colonnes déjà présentes sur une instance déjà migrée.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "participantIds" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "readerIds" TEXT[] NOT NULL DEFAULT '{}';
