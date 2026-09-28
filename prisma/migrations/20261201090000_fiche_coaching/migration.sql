-- LA FICHE DE COACHING — TOURNÉE EN DOUBLE (§118.157) : la grille versionnée administrée par le
-- directeur des opérations, et les fiches remplies par les managers.
--
-- Idempotent : `IF NOT EXISTS` partout, type et contraintes posés par bloc conditionnel. Aucune
-- donnée n'est semée ici : la version 1 de la grille (le classeur fourni par la Direction) est
-- écrite à la PREMIÈRE lecture par `lib/coaching/serveur.ts`, depuis la constante du module pur
-- — une seule source pour son contenu, et un banc peut l'exercer par le vrai chemin.
-- Le circuit documenté est `db:deploy` (jamais `psql` à la main — §118.110).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CoachingSheetStatus') THEN
    CREATE TYPE "CoachingSheetStatus" AS ENUM ('DRAFT', 'FINALIZED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CoachingGrid" (
    "id"          TEXT NOT NULL,
    "version"     INTEGER NOT NULL,
    "content"     JSONB NOT NULL,
    "note"        TEXT,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachingGrid_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CoachingSheet" (
    "id"             TEXT NOT NULL,
    "gridId"         TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "managerId"      TEXT,
    "visitDate"      DATE NOT NULL,
    "sector"         TEXT,
    "scores"         JSONB NOT NULL,
    "strengths"      TEXT,
    "improvements"   TEXT,
    "status"         "CoachingSheetStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt"    TIMESTAMP(3),
    "finalizedById"  TEXT,
    "createdById"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoachingSheet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachingGrid_version_key" ON "CoachingGrid"("version");
CREATE INDEX IF NOT EXISTS "CoachingSheet_collaboratorId_visitDate_idx" ON "CoachingSheet"("collaboratorId", "visitDate");
CREATE INDEX IF NOT EXISTS "CoachingSheet_managerId_idx" ON "CoachingSheet"("managerId");
CREATE INDEX IF NOT EXISTS "CoachingSheet_createdById_status_idx" ON "CoachingSheet"("createdById", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoachingGrid_createdById_fkey') THEN
    ALTER TABLE "CoachingGrid" ADD CONSTRAINT "CoachingGrid_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- UNE VERSION DE GRILLE NE SE SUPPRIME PAS tant qu'une fiche la porte : la fiche perdrait les
  -- critères sous lesquels elle a été remplie.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoachingSheet_gridId_fkey') THEN
    ALTER TABLE "CoachingSheet" ADD CONSTRAINT "CoachingSheet_gridId_fkey"
      FOREIGN KEY ("gridId") REFERENCES "CoachingGrid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoachingSheet_collaboratorId_fkey') THEN
    ALTER TABLE "CoachingSheet" ADD CONSTRAINT "CoachingSheet_collaboratorId_fkey"
      FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoachingSheet_managerId_fkey') THEN
    ALTER TABLE "CoachingSheet" ADD CONSTRAINT "CoachingSheet_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoachingSheet_finalizedById_fkey') THEN
    ALTER TABLE "CoachingSheet" ADD CONSTRAINT "CoachingSheet_finalizedById_fkey"
      FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CoachingSheet_createdById_fkey') THEN
    ALTER TABLE "CoachingSheet" ADD CONSTRAINT "CoachingSheet_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
