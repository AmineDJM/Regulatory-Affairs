-- Édition/modération des commentaires : horodatage de dernière édition.
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
