-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LA COULEUR D'UNE CELLULE D'ANNUAIRE (§118.133).
--
-- Les annuaires (praticiens, établissements) deviennent de vraies feuilles : on sélectionne des
-- cellules, on les colore, on copie. Une couleur est une DONNÉE partagée de la feuille — elle se
-- persiste, sous une CLÉ de palette fermée (jamais un code libre), et sous le même droit que la
-- cellule qu'elle colore.
--
-- Deux clés étrangères EXCLUSIVES (praticien OU établissement), toutes deux en CASCADE : une
-- ligne supprimée emporte ses couleurs, sans nettoyage à penser dans chaque action de
-- suppression — c'est ce qui empêche une table d'orphelins de grandir en silence.
--
-- IDEMPOTENTE, comme toute migration de ce dépôt : `IF NOT EXISTS` partout.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "DirectoryCellStyle" (
  "id"            TEXT NOT NULL,
  "doctorId"      TEXT,
  "institutionId" TEXT,
  "field"         TEXT NOT NULL,
  "color"         TEXT NOT NULL,
  "setById"       TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectoryCellStyle_pkey" PRIMARY KEY ("id")
);

-- UNE couleur par cellule : la clé (ligne, colonne) est unique de chaque côté.
CREATE UNIQUE INDEX IF NOT EXISTS "DirectoryCellStyle_doctorId_field_key"
  ON "DirectoryCellStyle" ("doctorId", "field");
CREATE UNIQUE INDEX IF NOT EXISTS "DirectoryCellStyle_institutionId_field_key"
  ON "DirectoryCellStyle" ("institutionId", "field");
CREATE INDEX IF NOT EXISTS "DirectoryCellStyle_doctorId_idx"
  ON "DirectoryCellStyle" ("doctorId");
CREATE INDEX IF NOT EXISTS "DirectoryCellStyle_institutionId_idx"
  ON "DirectoryCellStyle" ("institutionId");

DO $$ BEGIN
  ALTER TABLE "DirectoryCellStyle"
    ADD CONSTRAINT "DirectoryCellStyle_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DirectoryCellStyle"
    ADD CONSTRAINT "DirectoryCellStyle_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
