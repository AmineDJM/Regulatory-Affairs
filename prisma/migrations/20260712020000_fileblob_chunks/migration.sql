-- Stockage des gros blobs EN TRANCHES (bytea chunké) : un fichier volumineux (jusqu'à ~1 Go) est
-- écrit en plusieurs lignes ordonnées, sans construire un bytea unique dont l'encodage hex double la
-- taille sur le fil (cause d'OOM). Les petits fichiers gardent la colonne "data". Idempotent.
-- Rétrocompatible : les blobs existants (data ou storageKey) sont inchangés.
CREATE TABLE IF NOT EXISTS "FileBlobChunk" (
    "id" TEXT NOT NULL,
    "blobId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "FileBlobChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FileBlobChunk_blobId_idx_key" ON "FileBlobChunk"("blobId", "idx");

DO $$ BEGIN
  ALTER TABLE "FileBlobChunk" ADD CONSTRAINT "FileBlobChunk_blobId_fkey"
    FOREIGN KEY ("blobId") REFERENCES "FileBlob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
