-- LE PAPIER EN-TÊTE — le modèle Office qu'on ouvre au lieu d'une page blanche.
--
-- Un en-tête n'est pas une image qu'on colle : c'est un DOCUMENT déjà mis en page, avec ses
-- marges, son pied de page, sa police et ses mentions légales. On stocke donc un vrai .docx /
-- .xlsx / .pptx, et créer « avec en-tête » en recopie les octets — le résultat s'ouvre dans
-- l'éditeur exactement comme le modèle, sans conversion ni approximation.
--
-- Le binaire passe par le magasin de blobs chiffré et dédupliqué du Drive (`blobId`), comme
-- tout fichier de la plateforme : pas de second chemin de stockage à surveiller.
-- Idempotent : rejouable sur une instance déjà migrée.

CREATE TABLE IF NOT EXISTS "OfficeLetterhead" (
  "id"           TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "kind"         TEXT NOT NULL,
  "companyId"    TEXT,
  "blobId"       TEXT NOT NULL,
  "mime"         TEXT NOT NULL,
  "size"         INTEGER NOT NULL,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "uploadedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficeLetterhead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OfficeLetterhead_kind_isActive_idx" ON "OfficeLetterhead"("kind", "isActive");
CREATE INDEX IF NOT EXISTS "OfficeLetterhead_companyId_idx" ON "OfficeLetterhead"("companyId");

DO $$ BEGIN
  ALTER TABLE "OfficeLetterhead" ADD CONSTRAINT "OfficeLetterhead_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
