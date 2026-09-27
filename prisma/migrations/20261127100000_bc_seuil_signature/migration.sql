-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE SEUIL DES BONS DE COMMANDE, ET LA SIGNATURE DES FINANCES (§118.149).
--
-- « Tout BC supérieur à un montant configuré dans les centres de validations Ad&Pro devra passer
-- par la validation d'un des centres de validation. » Et : « un sous-module Bons de commande sous
-- Finances — les bons de commande à signer de leur part. »
--
--   • AppSetting.bcValidationThreshold — 0 par défaut : TOUT BC passe par un centre, exactement
--     comme avant la règle, jusqu'à ce que la Direction fixe le montant depuis le centre.
--   • LegalDocument.signedById — QUI a signé (la date existe déjà : `signedAt`).
--   • LegalDocument.bcCircuitAt — l'entrée d'un BC dans le circuit. Les BC d'avant la règle
--     restent nuls : fixer un seuil ne doit pas faire apparaître l'historique dans la file des
--     Finances comme s'il restait tout à signer.
--
-- Les BC qui portent DÉJÀ une porte (une demande de validation ou un visa, posés par la règle
-- précédente) sont dans le circuit : on le marque. Rien n'est signé à leur place.
--
-- Idempotente : relancée, elle ne fait rien.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "bcValidationThreshold" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "signedById" TEXT;
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "bcCircuitAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalDocument_signedById_fkey') THEN
    ALTER TABLE "LegalDocument"
      ADD CONSTRAINT "LegalDocument_signedById_fkey"
      FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "LegalDocument" d
SET "bcCircuitAt" = now()
WHERE d."kind" = 'PURCHASE_ORDER'
  AND d."bcCircuitAt" IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM "ValidationRequest" v
      WHERE v."entityType" = 'LEGAL_DOCUMENT' AND v."entityId" = d."id" AND v."objectType" = 'BON_DE_COMMANDE'
    )
    OR EXISTS (
      SELECT 1 FROM "AdProGateVisa" g
      WHERE g."entityType" = 'LEGAL_DOCUMENT' AND g."entityId" = d."id"
    )
  );
