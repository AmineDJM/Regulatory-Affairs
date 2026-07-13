-- Rappels personnels « en un clic » posés sur un dossier réglementaire, une demande du secrétariat,
-- un e-mail ou un sujet libre. À l'échéance (remindAt), un job planifié notifie le propriétaire.
-- SQL idempotent (relançable sans erreur).

DO $$ BEGIN
  CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Reminder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "note" TEXT,
  "link" TEXT,
  "entityType" "EntityType",
  "entityId" TEXT,
  "remindAt" TIMESTAMP(3) NOT NULL,
  "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Reminder_userId_status_idx" ON "Reminder"("userId", "status");
CREATE INDEX IF NOT EXISTS "Reminder_status_remindAt_idx" ON "Reminder"("status", "remindAt");

DO $$ BEGIN
  ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
