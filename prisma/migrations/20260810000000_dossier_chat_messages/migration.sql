-- Messagerie persistante du dossier (« Discuter avec ce dossier ») : un fil par (dossier, utilisateur),
-- pièces jointes conservées avec leur texte extrait. Idempotent.
CREATE TABLE IF NOT EXISTS "RegulatoryDossierChatMessage" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "files" JSONB,
    "attachments" JSONB,
    "error" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegulatoryDossierChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegulatoryDossierChatMessage_dossierId_userId_createdAt_idx"
    ON "RegulatoryDossierChatMessage"("dossierId", "userId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "RegulatoryDossierChatMessage"
        ADD CONSTRAINT "RegulatoryDossierChatMessage_dossierId_fkey"
        FOREIGN KEY ("dossierId") REFERENCES "RegulatoryDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
