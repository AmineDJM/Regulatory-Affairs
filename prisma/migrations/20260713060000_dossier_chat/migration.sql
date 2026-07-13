-- « Suivi & discussion » d'un dossier transformé en vrai chat : mentions (@) + pièces jointes
-- intégrées (comme la messagerie). SQL idempotent (relançable sans erreur).

-- Mentions : utilisateurs tagués dans un message (doivent être participants du dossier).
ALTER TABLE "DossierMessage" ADD COLUMN IF NOT EXISTS "mentionIds" TEXT[] NOT NULL DEFAULT '{}';

-- Pièces jointes d'un message (blob chiffré via le backend Drive), supprimées en cascade.
CREATE TABLE IF NOT EXISTS "DossierMessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "blobId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DossierMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DossierMessageAttachment_messageId_idx" ON "DossierMessageAttachment"("messageId");

DO $$ BEGIN
  ALTER TABLE "DossierMessageAttachment" ADD CONSTRAINT "DossierMessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "DossierMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
