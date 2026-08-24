-- L'ACCÈS PAR ANNUAIRE de praticiens — qui peut ouvrir « Cardiologues Centre ».
--
-- Liste VIDE = annuaire ouvert à tout le module : le cas normal, et le seul défaut sûr pour
-- l'existant. Nommer quelqu'un FERME l'annuaire à tous les autres (hors vue globale) — même
-- règle que les lecteurs désignés de Legal. Supprimer l'annuaire emporte ses accès.

CREATE TABLE IF NOT EXISTS "MedicalDirectoryAccess" (
  "id" TEXT NOT NULL,
  "directoryId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalDirectoryAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MedicalDirectoryAccess_directoryId_userId_key"
  ON "MedicalDirectoryAccess"("directoryId", "userId");
CREATE INDEX IF NOT EXISTS "MedicalDirectoryAccess_userId_idx" ON "MedicalDirectoryAccess"("userId");

DO $$ BEGIN
  ALTER TABLE "MedicalDirectoryAccess" ADD CONSTRAINT "MedicalDirectoryAccess_directoryId_fkey"
    FOREIGN KEY ("directoryId") REFERENCES "MedicalDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MedicalDirectoryAccess" ADD CONSTRAINT "MedicalDirectoryAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
