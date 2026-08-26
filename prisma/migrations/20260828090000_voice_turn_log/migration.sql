-- LE TOUR DE PAROLE VOCAL, MESURÉ — un enregistrement PAR TOUR (cf. VoiceTurnLog dans schema.prisma).
--
-- Idempotent de bout en bout : IF NOT EXISTS partout. La base de production a déjà servi des
-- appels ; cette migration n'y touche à AUCUNE donnée existante, elle ajoute une table neuve.
--
-- Aucun audio n'est stocké. La transcription finale l'est, parce que comparer « ce qui a été dit »
-- à « ce qui a été transcrit » est le seul moyen de distinguer une panne d'oreille d'une panne de
-- compréhension.

CREATE TABLE IF NOT EXISTS "VoiceTurnLog" (
  "id"              TEXT NOT NULL,
  "sessionId"       TEXT NOT NULL,
  "turnId"          TEXT NOT NULL,
  "userId"          TEXT NOT NULL,

  "speechMs"        INTEGER,
  "inputPeak"       INTEGER,
  "clipped"         BOOLEAN NOT NULL DEFAULT false,
  "inputDevice"     TEXT,

  "transcript"      TEXT,
  "confidence"      INTEGER,
  "partialCount"    INTEGER,
  "transcriptMs"    INTEGER,

  "interruptions"   INTEGER NOT NULL DEFAULT 0,
  "falseBargeIns"   INTEGER NOT NULL DEFAULT 0,
  "cutShort"        BOOLEAN NOT NULL DEFAULT false,

  "intentKind"      TEXT,
  "fastPath"        BOOLEAN NOT NULL DEFAULT false,
  "toolName"        TEXT,
  "toolOk"          BOOLEAN,
  "toolError"       TEXT,
  "intentMs"        INTEGER,
  "toolStartMs"     INTEGER,
  "toolMs"          INTEGER,

  "speakMs"         INTEGER,
  "firstResponseMs" INTEGER,
  "delivered"       BOOLEAN NOT NULL DEFAULT false,
  "nudged"          BOOLEAN NOT NULL DEFAULT false,
  "spokenChars"     INTEGER,

  "ok"              BOOLEAN NOT NULL DEFAULT false,
  "failedStage"     TEXT,
  "reasons"         TEXT,
  "slowLegs"        TEXT,

  "scenario"        TEXT,
  "device"          TEXT,

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VoiceTurnLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VoiceTurnLog_sessionId_idx"   ON "VoiceTurnLog"("sessionId");
CREATE INDEX IF NOT EXISTS "VoiceTurnLog_createdAt_idx"   ON "VoiceTurnLog"("createdAt");
CREATE INDEX IF NOT EXISTS "VoiceTurnLog_userId_idx"      ON "VoiceTurnLog"("userId");
CREATE INDEX IF NOT EXISTS "VoiceTurnLog_failedStage_idx" ON "VoiceTurnLog"("failedStage");
CREATE INDEX IF NOT EXISTS "VoiceTurnLog_scenario_idx"    ON "VoiceTurnLog"("scenario");
