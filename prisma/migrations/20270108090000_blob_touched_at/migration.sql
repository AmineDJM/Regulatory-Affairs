-- La purge des blobs orphelins ne doit jamais effacer un blob qu'un détenteur vient de prendre
-- (créé ou réemployé il y a moins d'une heure) : sa fiche est peut-être en train de s'écrire.
ALTER TABLE "FileBlob" ADD COLUMN IF NOT EXISTS "touchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
