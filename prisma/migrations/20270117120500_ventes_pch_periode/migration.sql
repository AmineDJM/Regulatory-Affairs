-- Ventes PCH : la période retenue pour chaque fichier importé (mois / année choisis à l'import). Idempotent.
ALTER TABLE "PchVenteImport" ADD COLUMN IF NOT EXISTS "periodeAnnee" INTEGER;
ALTER TABLE "PchVenteImport" ADD COLUMN IF NOT EXISTS "periodeMois" INTEGER;
ALTER TABLE "PchVenteImport" ADD COLUMN IF NOT EXISTS "periodeChoisie" BOOLEAN NOT NULL DEFAULT false;

-- Les imports existants : la période se lit sur leurs mois déjà enregistrés.
UPDATE "PchVenteImport"
SET "periodeAnnee" = CAST(SUBSTRING("mois"[1] FROM 1 FOR 4) AS INTEGER),
    "periodeMois" = CASE WHEN "annuel" OR COALESCE(array_length("mois", 1), 0) <> 1 THEN NULL ELSE CAST(SUBSTRING("mois"[1] FROM 6 FOR 2) AS INTEGER) END
WHERE "periodeAnnee" IS NULL AND COALESCE(array_length("mois", 1), 0) > 0;
