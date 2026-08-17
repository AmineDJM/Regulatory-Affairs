-- Téléversement DIRECT EN PLUSIEURS PARTIES, piloté par le navigateur.
-- Le serveur ouvre le téléversement (CreateMultipartUpload) et le referme (Complete) ; entre les
-- deux, le navigateur envoie les parties EN PARALLÈLE directement au bucket. Aucun octet ne passe
-- par l'application. `storageUploadId` retient l'identifiant S3 de ce téléversement.
-- Idempotent : rejouable sur une instance déjà migrée.

ALTER TABLE "RegulatoryUploadSession" ADD COLUMN IF NOT EXISTS "storageUploadId" TEXT;
