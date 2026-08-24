-- LES DOSSIERS DE CLASSEMENT DU COURRIER — l'armoire du registre, pendant exact de LegalFolder.
--
-- Cinq cents plis dans une liste se cherchent au filtre, jamais au regard. Un dossier RANGE, il
-- n'autorise pas : le cloisonnement par entité reste la seule règle d'accès. `SET NULL` sur le
-- rattachement d'un pli — supprimer un dossier DÉCLASSE ses plis, il ne les efface jamais.

CREATE TABLE IF NOT EXISTS "MailEntryFolder" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "companyId" TEXT,
  "parentId" TEXT,
  "description" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailEntryFolder_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MailEntry" ADD COLUMN IF NOT EXISTS "folderId" TEXT;

CREATE INDEX IF NOT EXISTS "MailEntryFolder_companyId_idx" ON "MailEntryFolder"("companyId");
CREATE INDEX IF NOT EXISTS "MailEntryFolder_parentId_idx" ON "MailEntryFolder"("parentId");
CREATE INDEX IF NOT EXISTS "MailEntry_folderId_idx" ON "MailEntry"("folderId");

DO $$ BEGIN
  ALTER TABLE "MailEntryFolder" ADD CONSTRAINT "MailEntryFolder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MailEntryFolder" ADD CONSTRAINT "MailEntryFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "MailEntryFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MailEntry" ADD CONSTRAINT "MailEntry_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "MailEntryFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
