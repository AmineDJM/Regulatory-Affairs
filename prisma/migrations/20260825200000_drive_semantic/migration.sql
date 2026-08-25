-- Vecteur sémantique (512d, JSONB — pgvector indisponible sur cette infra) de l'index textuel
-- du Drive : la recherche par le SENS quand le lexical ne trouve pas. NULL = pas encore
-- vectorisé (rattrapage borné par l'ingestion planifiée). Idempotent.
ALTER TABLE "DriveTextIndex" ADD COLUMN IF NOT EXISTS "embedding" JSONB;
