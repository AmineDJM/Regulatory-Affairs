-- Appels & réunions (Jitsi) : réunions/salles, participants, tâches proposées par l'IA.

-- Enums
DO $$ BEGIN
  CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MeetingKind" AS ENUM ('MEETING', 'CALL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "MeetingTaskStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Meeting
CREATE TABLE IF NOT EXISTS "Meeting" (
  "id"             TEXT NOT NULL,
  "title"          TEXT NOT NULL,
  "description"    TEXT,
  "slug"           TEXT NOT NULL,
  "publicToken"    TEXT NOT NULL,
  "kind"           "MeetingKind" NOT NULL DEFAULT 'MEETING',
  "status"         "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
  "withVideo"      BOOLEAN NOT NULL DEFAULT true,
  "scheduledAt"    TIMESTAMP(3),
  "startedAt"      TIMESTAMP(3),
  "endedAt"        TIMESTAMP(3),
  "organizerId"    TEXT NOT NULL,
  "conversationId" TEXT,
  "transcript"     TEXT,
  "summary"        TEXT,
  "audioBlobId"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_slug_key" ON "Meeting"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_publicToken_key" ON "Meeting"("publicToken");
CREATE INDEX IF NOT EXISTS "Meeting_organizerId_idx" ON "Meeting"("organizerId");
CREATE INDEX IF NOT EXISTS "Meeting_status_idx" ON "Meeting"("status");
CREATE INDEX IF NOT EXISTS "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");

-- MeetingParticipant
CREATE TABLE IF NOT EXISTS "MeetingParticipant" (
  "id"        TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingParticipant_meetingId_userId_key" ON "MeetingParticipant"("meetingId", "userId");
CREATE INDEX IF NOT EXISTS "MeetingParticipant_userId_idx" ON "MeetingParticipant"("userId");

-- MeetingTaskProposal
CREATE TABLE IF NOT EXISTS "MeetingTaskProposal" (
  "id"            TEXT NOT NULL,
  "meetingId"     TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "assigneeId"    TEXT,
  "status"        "MeetingTaskStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdTaskId" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingTaskProposal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MeetingTaskProposal_meetingId_idx" ON "MeetingTaskProposal"("meetingId");

-- Foreign keys
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey"
  FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingTaskProposal" ADD CONSTRAINT "MeetingTaskProposal_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingTaskProposal" ADD CONSTRAINT "MeetingTaskProposal_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
