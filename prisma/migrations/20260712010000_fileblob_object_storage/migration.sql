-- Stockage des blobs hors base (S3/R2) : le contenu chiffré peut vivre dans un bucket, la base ne
-- garde que les métadonnées → le disque Postgres arrête de gonfler. Rétrocompatible : les blobs
-- existants gardent leur contenu en base (storageKey NULL). Idempotent.
ALTER TABLE "FileBlob" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "FileBlob" ALTER COLUMN "data" DROP NOT NULL;
