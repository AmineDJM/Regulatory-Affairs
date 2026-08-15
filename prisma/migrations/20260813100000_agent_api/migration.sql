-- API POUR AGENTS — identités machine, journal des appels, idempotence, webhooks.
--
-- Un agent n'emprunte JAMAIS un compte humain partagé : il a sa propre identité, ses propres
-- portées, et se révoque sans couper personne. Deux couches d'autorisation : les portées disent
-- ce que l'intégration a le droit de faire, l'utilisateur « actAs » ce que cette identité voit.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WebhookStatus') THEN
    CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ApiClient" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "keyHash"     TEXT NOT NULL,
  "keyPrefix"   TEXT NOT NULL,
  "scopes"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "actAsUserId" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "expiresAt"   TIMESTAMP(3),
  "lastUsedAt"  TIMESTAMP(3),
  "note"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiClient_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiClient_keyHash_key" ON "ApiClient" ("keyHash");
CREATE INDEX IF NOT EXISTS "ApiClient_isActive_idx" ON "ApiClient" ("isActive");

CREATE TABLE IF NOT EXISTS "ApiCall" (
  "id"            TEXT NOT NULL,
  "clientId"      TEXT,
  "actorUserId"   TEXT,
  "correlationId" TEXT NOT NULL,
  "method"        TEXT NOT NULL,
  "path"          TEXT NOT NULL,
  "operationId"   TEXT,
  "entityType"    TEXT,
  "entityId"      TEXT,
  "status"        INTEGER NOT NULL,
  "ok"            BOOLEAN NOT NULL,
  "errorCode"     TEXT,
  "before"        JSONB,
  "after"         JSONB,
  "durationMs"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiCall_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApiCall_clientId_createdAt_idx" ON "ApiCall" ("clientId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApiCall_correlationId_idx" ON "ApiCall" ("correlationId");
CREATE INDEX IF NOT EXISTS "ApiCall_entityType_entityId_idx" ON "ApiCall" ("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "ApiCall_operationId_idx" ON "ApiCall" ("operationId");

CREATE TABLE IF NOT EXISTS "ApiIdempotencyKey" (
  "id"          TEXT NOT NULL,
  "clientId"    TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status"      INTEGER NOT NULL,
  "response"    JSONB NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiIdempotencyKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiIdempotencyKey_clientId_key_key" ON "ApiIdempotencyKey" ("clientId", "key");
CREATE INDEX IF NOT EXISTS "ApiIdempotencyKey_createdAt_idx" ON "ApiIdempotencyKey" ("createdAt");

CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
  "id"        TEXT NOT NULL,
  "clientId"  TEXT,
  "url"       TEXT NOT NULL,
  "secret"    TEXT NOT NULL,
  "events"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_isActive_idx" ON "WebhookEndpoint" ("isActive");

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id"          TEXT NOT NULL,
  "endpointId"  TEXT NOT NULL,
  "event"       TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "status"      "WebhookStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "lastError"   TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_createdAt_idx" ON "WebhookDelivery" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_endpointId_createdAt_idx" ON "WebhookDelivery" ("endpointId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiClient_actAsUserId_fkey') THEN
    ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_actAsUserId_fkey"
      FOREIGN KEY ("actAsUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiCall_clientId_fkey') THEN
    ALTER TABLE "ApiCall" ADD CONSTRAINT "ApiCall_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "ApiClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookEndpoint_clientId_fkey') THEN
    ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "ApiClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookDelivery_endpointId_fkey') THEN
    ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey"
      FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
