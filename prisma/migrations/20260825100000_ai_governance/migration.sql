-- Gouvernance des actions de l'IA (Executive AI OS) :
--   • arrêt d'urgence des actions EXTERNES de l'assistant (les lectures continuent) ;
--   • surveillance conditionnelle d'une entité par un rappel (« si pas validé sous 48 h,
--     préviens-moi » — ne prévient que le PROPRIÉTAIRE du rappel).
-- Idempotent.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "aiExternalActionsDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AssistantReminder" ADD COLUMN IF NOT EXISTS "watchType" TEXT;
ALTER TABLE "AssistantReminder" ADD COLUMN IF NOT EXISTS "watchId" TEXT;
ALTER TABLE "AssistantReminder" ADD COLUMN IF NOT EXISTS "watchLabel" TEXT;
