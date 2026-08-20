-- MESSAGERIE — envoyer un document du Drive SANS le recopier.
--
-- Une pièce jointe avait une seule nature : un blob téléversé. Envoyer un contrat de 40 Mo dans
-- cinq conversations en stockait donc cinq copies — et figeait cinq versions dont personne, six
-- mois plus tard, ne savait laquelle faisait foi. Une pièce jointe peut désormais être une
-- RÉFÉRENCE à un nœud du Drive : rien n'est recopié, les destinataires reçoivent un DriveShare
-- en lecture, et c'est toujours la version courante qui s'ouvre.
--
-- `blobId` devient donc FACULTATIF (il reste renseigné pour tout l'existant), et deux colonnes
-- apparaissent. Aucune donnée n'est réécrite.

ALTER TABLE "MessageAttachment" ALTER COLUMN "blobId" DROP NOT NULL;
ALTER TABLE "MessageAttachment" ADD COLUMN IF NOT EXISTS "driveNodeId" TEXT;
ALTER TABLE "MessageAttachment" ADD COLUMN IF NOT EXISTS "isFolder" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "MessageAttachment_driveNodeId_idx" ON "MessageAttachment" ("driveNodeId");

-- ON DELETE SET NULL : supprimer un fichier du Drive ne doit pas effacer le message qui en
-- parlait. La pièce reste listée, sans lien — « ce document n'est plus dans le Drive » est une
-- information ; un message amputé n'en est pas une.
DO $$
BEGIN
  ALTER TABLE "MessageAttachment"
    ADD CONSTRAINT "MessageAttachment_driveNodeId_fkey"
    FOREIGN KEY ("driveNodeId") REFERENCES "DriveNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
