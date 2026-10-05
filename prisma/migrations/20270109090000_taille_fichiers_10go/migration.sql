-- Fichiers jusqu'à 10 Go : la taille d'un fichier (octets) ne tient plus dans un entier 32 bits.
-- Float (double précision) : exact jusqu'à 9 Po, reste un `number` pour tout le code existant.
-- Idempotent : ne convertit que les colonnes encore en INTEGER.
-- ⚠ ALTER TYPE réécrit la table (FileBlob inclus) : verrou exclusif le temps de la réécriture.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('DriveNode'), ('FileVersion'), ('FileBlob')) AS t(tbl) LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = 'size' AND data_type = 'integer'
    ) THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN "size" TYPE DOUBLE PRECISION', r.tbl);
      IF r.tbl = 'DriveNode' THEN
        EXECUTE 'ALTER TABLE "DriveNode" ALTER COLUMN "size" SET DEFAULT 0';
      END IF;
    END IF;
  END LOOP;
END $$;

-- Le plafond par défaut d'un fichier du Drive passe de 1 Go à 10 Go ; une valeur choisie à la main
-- (≠ 1024) est conservée.
ALTER TABLE "AppSetting" ALTER COLUMN "maxDriveUploadMb" SET DEFAULT 10240;
UPDATE "AppSetting" SET "maxDriveUploadMb" = 10240 WHERE "maxDriveUploadMb" = 1024;
