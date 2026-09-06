-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- QUALITÉ DES DONNÉES (mandat 4 §23) — un constat par anomalie, à signature stable, et le
-- journal des balayages. Idempotent : rejouable sans effet.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "DataQualityFinding" (
  "id"           TEXT NOT NULL,
  "regle"        TEXT NOT NULL,
  "famille"      TEXT NOT NULL,
  "criticite"    TEXT NOT NULL,
  "confiance"    DOUBLE PRECISION NOT NULL,
  "resolution"   TEXT NOT NULL,
  "entite"       TEXT NOT NULL,
  "entiteId"     TEXT NOT NULL,
  "module"       TEXT NOT NULL,
  "titre"        TEXT NOT NULL,
  "detail"       TEXT NOT NULL,
  "signature"    TEXT NOT NULL,
  "href"         TEXT,
  "correction"   JSONB,
  "montant"      DECIMAL(14,2),
  "status"       TEXT NOT NULL DEFAULT 'OPEN',
  "firstSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurrences"  INTEGER NOT NULL DEFAULT 1,
  "reopenCount"  INTEGER NOT NULL DEFAULT 0,
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolvedBy"   TEXT,
  "motif"        TEXT,
  "fixLog"       JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataQualityFinding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DataQualityFinding_signature_key" ON "DataQualityFinding"("signature");
CREATE INDEX IF NOT EXISTS "DataQualityFinding_status_criticite_idx" ON "DataQualityFinding"("status", "criticite");
CREATE INDEX IF NOT EXISTS "DataQualityFinding_regle_status_idx" ON "DataQualityFinding"("regle", "status");
CREATE INDEX IF NOT EXISTS "DataQualityFinding_module_status_idx" ON "DataQualityFinding"("module", "status");
CREATE INDEX IF NOT EXISTS "DataQualityFinding_entite_entiteId_idx" ON "DataQualityFinding"("entite", "entiteId");

CREATE TABLE IF NOT EXISTS "DataQualitySweep" (
  "id"         TEXT NOT NULL,
  "mode"       TEXT NOT NULL,
  "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "ms"         INTEGER,
  "regles"     JSONB,
  "constats"   INTEGER NOT NULL DEFAULT 0,
  "nouveaux"   INTEGER NOT NULL DEFAULT 0,
  "corriges"   INTEGER NOT NULL DEFAULT 0,
  "resolus"    INTEGER NOT NULL DEFAULT 0,
  "erreurs"    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DataQualitySweep_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DataQualitySweep_mode_startedAt_idx" ON "DataQualitySweep"("mode", "startedAt");
