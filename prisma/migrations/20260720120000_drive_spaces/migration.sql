-- Catégories / espaces PARTAGÉS du Drive (ex. « Promotion Médicale »), présentés en onglets
-- à côté de « Drive » et « Documents ». Accès encadré comme une enveloppe budgétaire
-- (rôles/personnes en consultation + rôles/personnes gestionnaires).
CREATE TABLE IF NOT EXISTS "DriveSpace" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "icon"           TEXT,
  "accessRoles"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "accessUserIds"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "managerRoles"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "managerUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isArchived"     BOOLEAN NOT NULL DEFAULT false,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriveSpace_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DriveSpace_isArchived_idx" ON "DriveSpace"("isArchived");

-- Rattachement d'un nœud Drive à un espace (null = Drive PERSONNEL, comportement historique).
ALTER TABLE "DriveNode" ADD COLUMN IF NOT EXISTS "spaceId" TEXT;
CREATE INDEX IF NOT EXISTS "DriveNode_spaceId_idx" ON "DriveNode"("spaceId");
DO $$ BEGIN
  ALTER TABLE "DriveNode" ADD CONSTRAINT "DriveNode_spaceId_fkey"
    FOREIGN KEY ("spaceId") REFERENCES "DriveSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Rôles autorisés (par le Super Admin) à CRÉER des catégories de Drive.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "driveSpaceCreatorRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
