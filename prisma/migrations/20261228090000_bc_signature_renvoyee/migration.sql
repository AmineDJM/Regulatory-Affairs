-- LA SIGNATURE D'UN BON DE COMMANDE RENVOYÉE À SON ÉMETTEUR (audit 360°, R09).
-- Un signataire ne pouvait que signer : un BC erroné ne pouvait être ni refusé ni renvoyé. Les trois
-- colonnes disent qui l'a renvoyé, quand, et ce qu'il faut corriger ; toute modification de la pièce
-- les efface (`aiguillerBC`), et le BC revient à la signature. Idempotente : rien n'est rempli —
-- aucune signature passée n'est réinterprétée comme un renvoi.
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "signatureReturnedAt" TIMESTAMP(3);
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "signatureReturnedById" TEXT;
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "signatureReturnNote" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalDocument_signatureReturnedById_fkey') THEN
    ALTER TABLE "LegalDocument"
      ADD CONSTRAINT "LegalDocument_signatureReturnedById_fkey"
      FOREIGN KEY ("signatureReturnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
