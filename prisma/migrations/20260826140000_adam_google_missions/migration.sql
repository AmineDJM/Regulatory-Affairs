-- ADAM — le Chief of Staff VIVANT : identité de communication Google, ingestion Gmail,
-- intention d'envoi sous autorité du PDG, et missions de coordination humaine qui
-- survivent à un tour de conversation. Idempotent : rejouable sans effet sur une base
-- déjà à niveau.

DO $$ BEGIN
    CREATE TYPE "MailSendPolicy" AS ENUM ('REQUIRE_APPROVAL', 'AUTO_SEND', 'DRAFT_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OutboundMailStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'WAITING', 'PARTIAL', 'BLOCKED', 'NEEDS_CEO', 'READY_TO_SEND', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────── Politique de communication (une ligne « global », granularité future) ─────────────
CREATE TABLE IF NOT EXISTS "CommunicationPolicy" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "mailSendPolicy" "MailSendPolicy" NOT NULL DEFAULT 'REQUIRE_APPROVAL',
    "outboundPaused" BOOLEAN NOT NULL DEFAULT false,
    "inboundPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationPolicy_scope_key" ON "CommunicationPolicy"("scope");

-- ───────────── Connexion Google (jetons chiffrés au repos) ─────────────
CREATE TABLE IF NOT EXISTS "GoogleConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "displayName" TEXT,
    "googleSub" TEXT,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "grantedScopes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastError" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GoogleConnection_userId_key" ON "GoogleConnection"("userId");

DO $$ BEGIN
    ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────── État d'ingestion Gmail (watch + historyId + réconciliation) ─────────────
CREATE TABLE IF NOT EXISTS "GmailIngestionState" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "lastHistoryId" TEXT,
    "watchExpiration" TIMESTAMP(3),
    "watchTopic" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "lastWatchError" TEXT,
    "ingestedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmailIngestionState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GmailIngestionState_connectionId_key" ON "GmailIngestionState"("connectionId");

DO $$ BEGIN
    ALTER TABLE "GmailIngestionState" ADD CONSTRAINT "GmailIngestionState_connectionId_fkey"
        FOREIGN KEY ("connectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────── Missions (créées avant EmailRecord : celui-ci les référence) ─────────────
CREATE TABLE IF NOT EXISTS "Mission" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "context" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "entities" JSONB NOT NULL DEFAULT '[]',
    "extracted" JSONB NOT NULL DEFAULT '[]',
    "commitments" JSONB NOT NULL DEFAULT '[]',
    "nextAction" TEXT,
    "dueAt" TIMESTAMP(3),
    "lastNudgeAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Mission_ownerId_status_idx" ON "Mission"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "Mission_status_updatedAt_idx" ON "Mission"("status", "updatedAt");

DO $$ BEGIN
    ALTER TABLE "Mission" ADD CONSTRAINT "Mission_ownerId_fkey"
        FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MissionParticipant" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "name" TEXT,
    "state" TEXT NOT NULL DEFAULT 'ASKED',
    "responseNote" TEXT,
    "askedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "nudgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionParticipant_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MissionParticipant_missionId_idx" ON "MissionParticipant"("missionId");
CREATE INDEX IF NOT EXISTS "MissionParticipant_userId_idx" ON "MissionParticipant"("userId");

DO $$ BEGIN
    ALTER TABLE "MissionParticipant" ADD CONSTRAINT "MissionParticipant_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MissionEvent" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "actorId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MissionEvent_missionId_at_idx" ON "MissionEvent"("missionId", "at");

DO $$ BEGIN
    ALTER TABLE "MissionEvent" ADD CONSTRAINT "MissionEvent_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────── Messages ingérés + pièces jointes multimodales ─────────────
CREATE TABLE IF NOT EXISTS "EmailRecord" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "rfcMessageId" TEXT,
    "inReplyTo" TEXT,
    "referencesHeader" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'INBOUND',
    "fromAddress" TEXT NOT NULL,
    "fromName" TEXT,
    "toAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT,
    "snippet" TEXT,
    "sentAt" TIMESTAMP(3),
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "senderUserId" TEXT,
    "senderCompanyId" TEXT,
    "semantics" JSONB,
    "importance" TEXT,
    "surfacedAt" TIMESTAMP(3),
    "missionId" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailRecord_connectionId_providerMessageId_key" ON "EmailRecord"("connectionId", "providerMessageId");
CREATE INDEX IF NOT EXISTS "EmailRecord_connectionId_sentAt_idx" ON "EmailRecord"("connectionId", "sentAt");
CREATE INDEX IF NOT EXISTS "EmailRecord_threadId_idx" ON "EmailRecord"("threadId");
CREATE INDEX IF NOT EXISTS "EmailRecord_fromAddress_idx" ON "EmailRecord"("fromAddress");
CREATE INDEX IF NOT EXISTS "EmailRecord_missionId_idx" ON "EmailRecord"("missionId");

DO $$ BEGIN
    ALTER TABLE "EmailRecord" ADD CONSTRAINT "EmailRecord_connectionId_fkey"
        FOREIGN KEY ("connectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "EmailRecord" ADD CONSTRAINT "EmailRecord_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "EmailAttachmentRecord" (
    "id" TEXT NOT NULL,
    "emailRecordId" TEXT NOT NULL,
    "providerAttachmentId" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "extractedText" TEXT,
    "extractionNote" TEXT,
    "driveNodeId" TEXT,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAttachmentRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EmailAttachmentRecord_emailRecordId_idx" ON "EmailAttachmentRecord"("emailRecordId");

DO $$ BEGIN
    ALTER TABLE "EmailAttachmentRecord" ADD CONSTRAINT "EmailAttachmentRecord_emailRecordId_fkey"
        FOREIGN KEY ("emailRecordId") REFERENCES "EmailRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ───────────── Intention d'envoi : le SEUL chemin de sortie ─────────────
CREATE TABLE IF NOT EXISTS "OutboundMailIntent" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "inReplyTo" TEXT,
    "referencesHeader" TEXT,
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bcc" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "missionId" TEXT,
    "reason" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'chief',
    "status" "OutboundMailStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "policyAtCreation" "MailSendPolicy" NOT NULL DEFAULT 'REQUIRE_APPROVAL',
    "contentHash" TEXT NOT NULL,
    "approvedHash" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "sendingStartedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "providerThreadId" TEXT,
    "failureReason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "events" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMailIntent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OutboundMailIntent_idempotencyKey_key" ON "OutboundMailIntent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "OutboundMailIntent_userId_status_idx" ON "OutboundMailIntent"("userId", "status");
CREATE INDEX IF NOT EXISTS "OutboundMailIntent_missionId_idx" ON "OutboundMailIntent"("missionId");
CREATE INDEX IF NOT EXISTS "OutboundMailIntent_connectionId_createdAt_idx" ON "OutboundMailIntent"("connectionId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "OutboundMailIntent" ADD CONSTRAINT "OutboundMailIntent_connectionId_fkey"
        FOREIGN KEY ("connectionId") REFERENCES "GoogleConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "OutboundMailIntent" ADD CONSTRAINT "OutboundMailIntent_missionId_fkey"
        FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
