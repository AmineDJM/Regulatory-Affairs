-- Annuaires : archivage RÉVERSIBLE des praticiens (Direction, 06/10).
-- « Supprimer » une ligne l'archive : la fiche reste en base, sort de la feuille, des comptes, de
-- l'export et de la recherche, et se restaure depuis la vue « Archivés ». Additive et idempotente :
-- aucune fiche existante n'est touchée (archivedAt reste NULL = active).

ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "MedicalDoctor" ADD COLUMN IF NOT EXISTS "archivedById" TEXT;
CREATE INDEX IF NOT EXISTS "MedicalDoctor_archivedAt_idx" ON "MedicalDoctor"("archivedAt");
