-- LES LECTEURS D'UN DOCUMENT LÉGAL — le déposant désigne qui peut l'ouvrir.
--
-- Un engagement de la société n'est pas une pièce d'équipe. Un bail, un protocole d'accord, un
-- contrat de cadre ne se lisent pas parce qu'on a le module Legal : celui qui dépose choisit ses
-- lecteurs, et hors d'eux le document n'existe pas — ni dans la liste, ni par son identifiant.
--
-- L'HISTORIQUE N'EST PAS REFERMÉ. Aucune ligne n'est créée ici : un document sans lecteur
-- désigné reste ouvert au module, exactement comme avant. Deviner des listes de lecteurs aurait
-- fermé des documents à ceux qui s'en servent, sans que personne sache lesquels.
-- Idempotent : rejouable sur une instance déjà migrée.

CREATE TABLE IF NOT EXISTS "LegalDocumentReader" (
  "id"          TEXT NOT NULL,
  "documentId"  TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "grantedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegalDocumentReader_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegalDocumentReader_documentId_userId_key" ON "LegalDocumentReader"("documentId", "userId");
CREATE INDEX IF NOT EXISTS "LegalDocumentReader_documentId_idx" ON "LegalDocumentReader"("documentId");
CREATE INDEX IF NOT EXISTS "LegalDocumentReader_userId_idx" ON "LegalDocumentReader"("userId");

DO $$ BEGIN
  ALTER TABLE "LegalDocumentReader" ADD CONSTRAINT "LegalDocumentReader_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LegalDocumentReader" ADD CONSTRAINT "LegalDocumentReader_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
