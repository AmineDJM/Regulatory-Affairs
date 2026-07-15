-- Statut de messagerie façon Teams : statut manuel + message perso sur le compte utilisateur.
-- SQL idempotent (relançable sans erreur).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "statusMessage" TEXT;
