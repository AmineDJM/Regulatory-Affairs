-- Segments thérapeutiques configurables par l'administrateur (tableau Regulatory).
-- Idempotent : la colonne peut déjà exister sur une instance déjà migrée.
ALTER TABLE "AppSetting"
  ADD COLUMN IF NOT EXISTS "regulatoryTherapeuticSegments" TEXT[] NOT NULL DEFAULT '{}';
