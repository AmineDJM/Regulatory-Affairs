-- UN COURRIER PEUT POINTER VERS LE DRIVE — comme un document légal le fait déjà.
--
-- Le fichier RESTE dans le Drive : le courrier le référence, il ne le recopie pas. Deux copies
-- auraient divergé dès la première correction, et plus personne n'aurait su laquelle fait foi.
-- Le lien tombe en NULL si le nœud disparaît : un courrier ne s'efface pas parce qu'on a rangé
-- son fichier ailleurs.
-- Idempotent : rejouable sur une instance déjà migrée.

ALTER TABLE "MailEntry" ADD COLUMN IF NOT EXISTS "driveNodeId" TEXT;
CREATE INDEX IF NOT EXISTS "MailEntry_driveNodeId_idx" ON "MailEntry"("driveNodeId");

DO $$ BEGIN
  ALTER TABLE "MailEntry" ADD CONSTRAINT "MailEntry_driveNodeId_fkey"
    FOREIGN KEY ("driveNodeId") REFERENCES "DriveNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
