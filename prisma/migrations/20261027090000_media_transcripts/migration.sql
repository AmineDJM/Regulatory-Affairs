-- La transcription d'un média du Drive (mandat 5 §38). Idempotent.
CREATE TABLE IF NOT EXISTS "MediaTranscript" (
  "id"          TEXT PRIMARY KEY,
  "nodeId"      TEXT NOT NULL,
  "version"     INTEGER NOT NULL,
  "nom"         TEXT NOT NULL,
  "langue"      TEXT,
  "dureeS"      INTEGER,
  "modele"      TEXT NOT NULL,
  "segments"    JSONB NOT NULL,
  "chapitres"   JSONB NOT NULL,
  "locuteurs"   JSONB NOT NULL,
  "extraction"  JSONB,
  "texte"       TEXT NOT NULL,
  "coutUsd"     DOUBLE PRECISION,
  "horodate"    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MediaTranscript_nodeId_version_key" ON "MediaTranscript"("nodeId", "version");
CREATE INDEX IF NOT EXISTS "MediaTranscript_createdAt_idx" ON "MediaTranscript"("createdAt");
