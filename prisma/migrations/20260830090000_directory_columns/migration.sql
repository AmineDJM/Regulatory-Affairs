-- COLONNES PROPRES À UN ANNUAIRE DE PRATICIENS.
--
-- Idempotent : rejouable sans dommage (règle du projet — migrations SQL manuelles).
-- Table NEUVE, aucune donnée existante touchée. Les valeurs saisies dans ces colonnes vivent
-- dans `MedicalDoctor.custom` (JSON, déjà présent) : ajouter un champ ne migre pas la base.

CREATE TABLE IF NOT EXISTS "MedicalDirectoryColumn" (
  "id"          TEXT PRIMARY KEY,
  "directoryId" TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "label"       TEXT NOT NULL,
  "kind"        TEXT NOT NULL DEFAULT 'TEXT',
  "options"     TEXT,
  "position"    INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "MedicalDirectoryColumn_directoryId_key_key"
  ON "MedicalDirectoryColumn"("directoryId", "key");
CREATE INDEX IF NOT EXISTS "MedicalDirectoryColumn_directoryId_idx"
  ON "MedicalDirectoryColumn"("directoryId");

-- Supprimer l'annuaire emporte ses colonnes : une colonne sans annuaire ne veut rien dire.
DO $$ BEGIN
  ALTER TABLE "MedicalDirectoryColumn"
    ADD CONSTRAINT "MedicalDirectoryColumn_directoryId_fkey"
    FOREIGN KEY ("directoryId") REFERENCES "MedicalDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
