-- Rappel de réunion : horodatage d'envoi (anti double-envoi).
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Meeting_reminder_idx" ON "Meeting"("status", "scheduledAt", "reminderSentAt");
