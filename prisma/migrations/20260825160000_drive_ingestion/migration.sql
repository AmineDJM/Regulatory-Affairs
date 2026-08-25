-- INGESTION DRIVE EXHAUSTIVE — l'index textuel n'attend plus qu'un fichier soit lu : une tâche
-- planifiée ingère progressivement tout le Drive (par petits paquets), et chaque texte extrait
-- reçoit une CLASSIFICATION déterministe (contrat de travail, facture, devis, BC…).
-- Idempotent : rejouable sans effet sur une base déjà à niveau.

ALTER TABLE "DriveTextIndex" ADD COLUMN IF NOT EXISTS "docKind" TEXT;
CREATE INDEX IF NOT EXISTS "DriveTextIndex_docKind_idx" ON "DriveTextIndex"("docKind");
