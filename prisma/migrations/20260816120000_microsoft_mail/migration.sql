-- Messagerie Microsoft 365 / Exchange Online.
-- Microsoft reste la SOURCE DE VÉRITÉ : on ne stocke ici que la connexion, les jetons chiffrés,
-- l'état de synchronisation par dossier et les liens vers l'ERP. Aucun corps de message, aucune
-- pièce jointe. Idempotent — rejouable sans dommage.

CREATE TABLE IF NOT EXISTS "MailConnection" (
  "id"              TEXT PRIMARY KEY,
  "userId"          TEXT NOT NULL,
  "provider"        TEXT NOT NULL DEFAULT 'microsoft',
  "address"         TEXT NOT NULL,
  "displayName"     TEXT,
  "homeAccountId"   TEXT,
  "accessTokenEnc"  TEXT,
  "refreshTokenEnc" TEXT,
  "expiresAt"       TIMESTAMP(3),
  "grantedScopes"   TEXT,
  "signature"       TEXT,
  "status"          TEXT NOT NULL DEFAULT 'connected',
  "lastError"       TEXT,
  "lastSyncAt"      TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MailConnection_userId_key" ON "MailConnection"("userId");

DO $$ BEGIN
  ALTER TABLE "MailConnection"
    ADD CONSTRAINT "MailConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MailFolderState" (
  "id"            TEXT PRIMARY KEY,
  "connectionId"  TEXT NOT NULL,
  "folderId"      TEXT NOT NULL,
  "displayName"   TEXT,
  "wellKnown"     TEXT,
  "deltaTokenEnc" TEXT,
  "unread"        INTEGER NOT NULL DEFAULT 0,
  "total"         INTEGER NOT NULL DEFAULT 0,
  "lastSyncAt"    TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MailFolderState_connectionId_folderId_key"
  ON "MailFolderState"("connectionId", "folderId");

DO $$ BEGIN
  ALTER TABLE "MailFolderState"
    ADD CONSTRAINT "MailFolderState_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "MailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MailLink" (
  "id"            TEXT PRIMARY KEY,
  "connectionId"  TEXT NOT NULL,
  "messageId"     TEXT NOT NULL,
  "attachmentId"  TEXT,
  "senderAddress" TEXT,
  "sentAt"        TIMESTAMP(3),
  "subject"       TEXT,
  "entityType"    TEXT,
  "entityId"      TEXT,
  "driveNodeId"   TEXT,
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MailLink_connectionId_messageId_idx" ON "MailLink"("connectionId", "messageId");
CREATE INDEX IF NOT EXISTS "MailLink_entityType_entityId_idx" ON "MailLink"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "MailLink"
    ADD CONSTRAINT "MailLink_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "MailConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
