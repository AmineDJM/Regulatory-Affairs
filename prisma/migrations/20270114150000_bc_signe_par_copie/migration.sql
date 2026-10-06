-- LE BC SIGNÉ SUR PAPIER (Direction, 06/10) : les Finances téléversent la copie signée et nomment le signataire ;
-- Luna confirme la signature repérée. Additif et idempotent : aucune ligne existante n'est réécrite.
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "signedByName" TEXT;
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "signatureCheck" JSONB;
