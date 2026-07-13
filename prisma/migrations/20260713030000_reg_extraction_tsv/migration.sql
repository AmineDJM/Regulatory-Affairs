-- Ranking sémantique plus fin pour l'Analyse de CTD : colonne tsvector indexée (GIN) alimentée
-- AUTOMATIQUEMENT à l'extraction (colonne générée à partir de `content`). Le texte est borné à
-- 1 Mo avant vectorisation pour rester sous la limite de taille d'un tsvector (OCR de milliers de
-- pages) et ne jamais faire échouer l'insertion. Colonne DB-only (non gérée par Prisma) : la
-- recherche l'utilise via SQL brut (ts_rank_cd) ; l'ORM continue de l'ignorer.

ALTER TABLE "RegulatoryExtraction"
  ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('french', left(coalesce("content", ''), 1048576))) STORED;

CREATE INDEX IF NOT EXISTS "RegulatoryExtraction_tsv_idx" ON "RegulatoryExtraction" USING GIN ("tsv");
