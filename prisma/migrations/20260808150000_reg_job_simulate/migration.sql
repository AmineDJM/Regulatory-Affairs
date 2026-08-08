-- Simulation d'examen intégrée au pipeline d'analyse.
-- Idempotent : ADD VALUE IF NOT EXISTS ne rejoue rien si la valeur existe déjà.
ALTER TYPE "RegJobType" ADD VALUE IF NOT EXISTS 'SIMULATE';
