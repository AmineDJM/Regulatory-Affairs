-- INTELLIGENCE TERRAIN (console d'administration, Super Admin seul — Direction, 10/2026) :
--   1. LES LIENS D'INFLUENCE entre praticiens (structure du service, co-orateurs, liens proposés par Luna depuis les rapports) ;
--   2. LE SCORE D'INFLUENCE en cache, avec ses raisons ;
--   3. LE FILIGRANE des analyses incrémentales (jusqu'où les rapports ont été lus).
--
-- Idempotente : rejouée, elle ne change plus rien.

-- 1. LES LIENS ───────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PraticienRelation" (
  "id"            TEXT NOT NULL,
  "fromDoctorId"  TEXT NOT NULL,
  "toDoctorId"    TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "source"        TEXT NOT NULL,
  "confidence"    DOUBLE PRECISION NOT NULL DEFAULT 1,
  "evidence"      TEXT,
  "reportId"      TEXT,
  "rapprochement" TEXT,
  "statut"        TEXT NOT NULL DEFAULT 'PROPOSEE',
  "decideParId"   TEXT,
  "decideLe"      TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PraticienRelation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PraticienRelation_fromDoctorId_toDoctorId_type_key" ON "PraticienRelation" ("fromDoctorId", "toDoctorId", "type");
CREATE INDEX IF NOT EXISTS "PraticienRelation_toDoctorId_idx" ON "PraticienRelation" ("toDoctorId");
CREATE INDEX IF NOT EXISTS "PraticienRelation_statut_source_idx" ON "PraticienRelation" ("statut", "source");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PraticienRelation_fromDoctorId_fkey') THEN
    ALTER TABLE "PraticienRelation"
      ADD CONSTRAINT "PraticienRelation_fromDoctorId_fkey" FOREIGN KEY ("fromDoctorId") REFERENCES "MedicalDoctor" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PraticienRelation_toDoctorId_fkey') THEN
    ALTER TABLE "PraticienRelation"
      ADD CONSTRAINT "PraticienRelation_toDoctorId_fkey" FOREIGN KEY ("toDoctorId") REFERENCES "MedicalDoctor" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. LE SCORE EN CACHE ───────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InfluenceScore" (
  "doctorId"   TEXT NOT NULL,
  "score"      INTEGER NOT NULL,
  "raisons"    JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InfluenceScore_pkey" PRIMARY KEY ("doctorId")
);
CREATE INDEX IF NOT EXISTS "InfluenceScore_score_idx" ON "InfluenceScore" ("score");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InfluenceScore_doctorId_fkey') THEN
    ALTER TABLE "InfluenceScore"
      ADD CONSTRAINT "InfluenceScore_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. LE FILIGRANE ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AnalyseWatermark" (
  "cle"               TEXT NOT NULL,
  "dernierLe"         TIMESTAMP(3),
  "dernierId"         TEXT,
  "derniereExecution" TIMESTAMP(3),
  "bilan"             JSONB,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyseWatermark_pkey" PRIMARY KEY ("cle")
);
