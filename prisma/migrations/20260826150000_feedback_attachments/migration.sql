-- PIÈCES JOINTES DES RETOURS (Feedback).
--
-- Le contenu n'est PAS dans cette table : il vit dans FileBlob, le magasin chiffré et
-- dédupliqué déjà utilisé par la messagerie, les projets et les réunions. Ici on ne garde que
-- le lien, le nom assaini, le type servi, la taille, l'auteur du dépôt et la date.
--
-- Idempotent (IF NOT EXISTS partout) : la migration peut être rejouée sans casser un
-- déploiement déjà passé.

CREATE TABLE IF NOT EXISTS "FeedbackAttachment" (
  "id"           TEXT NOT NULL,
  "feedbackId"   TEXT NOT NULL,
  "blobId"       TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "mime"         TEXT NOT NULL,
  "size"         INTEGER NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FeedbackAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FeedbackAttachment_feedbackId_idx" ON "FeedbackAttachment"("feedbackId");
CREATE INDEX IF NOT EXISTS "FeedbackAttachment_blobId_idx"     ON "FeedbackAttachment"("blobId");

-- Un retour supprimé emporte ses pièces (le blob, lui, est libéré par refCount).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedbackAttachment_feedbackId_fkey') THEN
    ALTER TABLE "FeedbackAttachment"
      ADD CONSTRAINT "FeedbackAttachment_feedbackId_fkey"
      FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeedbackAttachment_uploadedById_fkey') THEN
    ALTER TABLE "FeedbackAttachment"
      ADD CONSTRAINT "FeedbackAttachment_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
