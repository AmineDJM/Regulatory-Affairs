-- Fil de discussion (chat) d'une réunion : messages texte + pièces jointes intégrées
-- (blob chiffré via le backend Drive), comme le chat des dossiers. SQL idempotent.

-- Messages du fil d'une réunion.
CREATE TABLE IF NOT EXISTS "MeetingMessage" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "authorId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetingMessage_meetingId_idx" ON "MeetingMessage"("meetingId");

DO $$ BEGIN
  ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingMessage" ADD CONSTRAINT "MeetingMessage_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Pièces jointes d'un message (blob chiffré via le backend Drive), supprimées en cascade.
CREATE TABLE IF NOT EXISTS "MeetingMessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "blobId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MeetingMessageAttachment_messageId_idx" ON "MeetingMessageAttachment"("messageId");

DO $$ BEGIN
  ALTER TABLE "MeetingMessageAttachment" ADD CONSTRAINT "MeetingMessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "MeetingMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
