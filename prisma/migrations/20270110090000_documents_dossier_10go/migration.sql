-- Documents : fichiers jusqu'à 10 Go et dépôt de DOSSIERS avec leur arborescence.
-- Idempotent.
--  • sizeBytes passe en double précision (exact jusqu'à 9 Po) : un fichier de plus de 2 Go ne tient pas
--    dans un entier 32 bits. ⚠ ALTER TYPE réécrit la table le temps de la conversion.
--  • folder : chemin du dossier d'origine (« Module 3/3.2.P ») quand on dépose un dossier ; null sinon.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Document' AND column_name = 'sizeBytes' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "Document" ALTER COLUMN "sizeBytes" TYPE DOUBLE PRECISION;
  END IF;
END $$;

-- StoredFile (clé de fichier → blob) : même plafond, sinon un document de plus de 2 Go ne s'inscrit pas.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'StoredFile' AND column_name = 'size' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "StoredFile" ALTER COLUMN "size" TYPE DOUBLE PRECISION;
  END IF;
END $$;

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "folder" TEXT;
