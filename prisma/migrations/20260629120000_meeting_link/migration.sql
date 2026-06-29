-- Lien de réunion externe (Meet/Teams/Zoom) — remplace l'embed Jitsi à l'affichage.
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "meetLink" TEXT;
