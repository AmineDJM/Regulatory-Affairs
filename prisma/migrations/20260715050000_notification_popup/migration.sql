-- Notification en pop-up plein écran (grande fenêtre centrée) diffusée depuis l'Administration.
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "popup" BOOLEAN NOT NULL DEFAULT false;
