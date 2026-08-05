-- COURRIER « SMART » : envoi par API HTTPS (port 443) au lieu de SMTP, réception par webhook.
-- Journal des envois + messages entrants. Idempotent — sûr à rejouer.

DO $$ BEGIN
  CREATE TYPE "OutboundEmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "OutboundEmail" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT,
  "toAddress"  TEXT NOT NULL,
  "ccAddress"  TEXT,
  "subject"    TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "isHtml"     BOOLEAN NOT NULL DEFAULT false,
  "status"     "OutboundEmailStatus" NOT NULL DEFAULT 'QUEUED',
  "provider"   TEXT,
  "providerId" TEXT,
  "error"      TEXT,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"     TIMESTAMP(3),
  CONSTRAINT "OutboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InboundEmail" (
  "id"          TEXT NOT NULL,
  "provider"    TEXT NOT NULL,
  "messageId"   TEXT,
  "fromAddress" TEXT NOT NULL,
  "fromName"    TEXT,
  "toAddress"   TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "text"        TEXT NOT NULL,
  "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboundEmail_userId_createdAt_idx" ON "OutboundEmail"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "OutboundEmail_status_createdAt_idx" ON "OutboundEmail"("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "InboundEmail_messageId_key" ON "InboundEmail"("messageId");
CREATE INDEX IF NOT EXISTS "InboundEmail_toAddress_receivedAt_idx" ON "InboundEmail"("toAddress", "receivedAt");

DO $$ BEGIN
  ALTER TABLE "OutboundEmail" ADD CONSTRAINT "OutboundEmail_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
