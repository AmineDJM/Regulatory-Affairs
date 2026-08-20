-- DOSSIERS DE CLASSEMENT DES ENGAGEMENTS (Legal).
--
-- Trois cents contrats dans une seule liste se cherchent au filtre, jamais au regard. Le dossier
-- rend au module la structure des armoires réelles. Il ne porte AUCUN droit : la restriction d'un
-- engagement reste sur lui (ses lecteurs désignés) et sur son entité.
--
-- Idempotent : réexécutable sans effet.

CREATE TABLE IF NOT EXISTS "LegalFolder" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "companyId"   TEXT,
  "parentId"    TEXT,
  "description" TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LegalFolder_companyId_idx" ON "LegalFolder" ("companyId");
CREATE INDEX IF NOT EXISTS "LegalFolder_parentId_idx"  ON "LegalFolder" ("parentId");

DO $$ BEGIN
  ALTER TABLE "LegalFolder" ADD CONSTRAINT "LegalFolder_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Supprimer un dossier emporte ses SOUS-dossiers (ils n'ont pas de sens sans lui) ; les
-- documents, eux, sont déclassés, jamais supprimés — voir la contrainte suivante.
DO $$ BEGIN
  ALTER TABLE "LegalFolder" ADD CONSTRAINT "LegalFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "LegalFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "folderId" TEXT;
CREATE INDEX IF NOT EXISTS "LegalDocument_folderId_idx" ON "LegalDocument" ("folderId");

-- SET NULL et non CASCADE : ranger un engagement dans un dossier ne doit jamais permettre de le
-- faire disparaître en supprimant le dossier. On déclasse, on ne détruit pas.
DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "LegalFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
