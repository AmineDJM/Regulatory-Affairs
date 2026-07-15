-- Réunions : mode PRÉSENTIEL (lieu physique, sans lien en ligne) + réponse d'invitation
-- par participant (accepter / refuser, façon agenda). Idempotent.
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "inPerson" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "location" TEXT;
-- Le type enum "CalendarInviteStatus" existe déjà (invitations de calendrier) → on le réutilise.
ALTER TABLE "MeetingParticipant" ADD COLUMN IF NOT EXISTS "response" "CalendarInviteStatus" NOT NULL DEFAULT 'INVITED';
