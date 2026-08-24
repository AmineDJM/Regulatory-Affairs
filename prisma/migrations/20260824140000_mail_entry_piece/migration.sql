-- UNE PIÈCE DE COURRIER, AVEC SON PROPRE DESTINATAIRE.
--
-- Un pli porte souvent plusieurs pièces qui ne vont pas au même endroit : le contrat signé pour le
-- fournisseur, la copie pour les finances, l'attestation pour l'ANPP. Un destinataire unique au
-- niveau du courrier oblige à créer trois courriers pour un seul envoi — et la trace de ce qui est
-- parti à qui se perd.
--
-- La pièce est SOIT un document téléversé, SOIT une référence au Drive (jamais recopiée). Les deux
-- rattachements sont en SET NULL : effacer un document ou sortir un fichier du Drive ne doit pas
-- faire disparaître la ligne qui dit « ceci a été envoyé à untel ».

CREATE TABLE IF NOT EXISTS "MailEntryPiece" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "recipient" TEXT,
  "documentId" TEXT,
  "driveNodeId" TEXT,
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailEntryPiece_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MailEntryPiece_entryId_idx" ON "MailEntryPiece"("entryId");
CREATE INDEX IF NOT EXISTS "MailEntryPiece_documentId_idx" ON "MailEntryPiece"("documentId");
CREATE INDEX IF NOT EXISTS "MailEntryPiece_driveNodeId_idx" ON "MailEntryPiece"("driveNodeId");

DO $$ BEGIN
  ALTER TABLE "MailEntryPiece" ADD CONSTRAINT "MailEntryPiece_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "MailEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MailEntryPiece" ADD CONSTRAINT "MailEntryPiece_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MailEntryPiece" ADD CONSTRAINT "MailEntryPiece_driveNodeId_fkey"
    FOREIGN KEY ("driveNodeId") REFERENCES "DriveNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
