-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ADAM — LA SURVEILLANCE DURABLE (« surveille ce dossier et préviens-moi seulement s'il y a un problème »).
--
-- Une surveillance est portée par une mission (kind WATCH) : journal, porte d'attention, conduite
-- et écran viennent d'elle. Cette table porte la cible, les règles (code, pas modèle), la cadence,
-- le dernier état observé et la dernière signature de problème signalée — ce qui rend « seulement
-- s'il y a un problème » exact et indifférent aux redémarrages.
--
-- Idempotent : rejouable sans effet.

CREATE TABLE IF NOT EXISTS "AdamWatch" (
  "id"            TEXT NOT NULL,
  "ownerId"       TEXT NOT NULL,
  "missionId"     TEXT NOT NULL,
  "label"         TEXT NOT NULL,
  "targetType"    TEXT NOT NULL,
  "targetId"      TEXT NOT NULL,
  "targetRef"     TEXT,
  "rules"         JSONB NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'ACTIVE',
  "checkEveryH"   INTEGER NOT NULL DEFAULT 24,
  "nextCheckAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3),
  "lastState"     JSONB,
  "lastSignature" TEXT,
  "lastSignalAt"  TIMESTAMP(3),
  "closeReason"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdamWatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdamWatch_missionId_key" ON "AdamWatch" ("missionId");
CREATE INDEX IF NOT EXISTS "AdamWatch_status_nextCheckAt_idx" ON "AdamWatch" ("status", "nextCheckAt");
CREATE INDEX IF NOT EXISTS "AdamWatch_ownerId_status_idx" ON "AdamWatch" ("ownerId", "status");
CREATE INDEX IF NOT EXISTS "AdamWatch_targetType_targetId_idx" ON "AdamWatch" ("targetType", "targetId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamWatch_ownerId_fkey') THEN
    ALTER TABLE "AdamWatch"
      ADD CONSTRAINT "AdamWatch_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdamWatch_missionId_fkey') THEN
    ALTER TABLE "AdamWatch"
      ADD CONSTRAINT "AdamWatch_missionId_fkey"
      FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;
