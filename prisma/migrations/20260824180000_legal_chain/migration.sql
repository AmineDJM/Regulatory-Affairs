-- LA CHAÎNE DU DOSSIER D'ACHAT — devis → bon de commande → facture → règlement.
--
-- Les pièces existaient déjà, chacune dans son coin : un devis dans Legal, un BC dans Legal, une
-- facture aux Finances, un règlement dans les ordres de dépense — et le rapprochement se faisait
-- de tête. La chaîne les LIE : chaque pièce pointe vers celle dont elle découle, et la fiche lit
-- l'achat d'un bout à l'autre, avec les validateurs et les délais de chaque maillon.
--
-- Deux natures rejoignent Legal : le DEVIS (premier maillon) et la FACTURE (dernier maillon avant
-- le règlement — l'ordre de dépense, qui passe par le centre de paiement comme toute dépense).

ALTER TYPE "LegalDocKind" ADD VALUE IF NOT EXISTS 'QUOTE';
ALTER TYPE "LegalDocKind" ADD VALUE IF NOT EXISTS 'INVOICE';

-- `SET NULL` : supprimer un maillon casse le fil, il n'efface pas les pièces suivantes.
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "chainFromId" TEXT;
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "expenseOrderId" TEXT;

CREATE INDEX IF NOT EXISTS "LegalDocument_chainFromId_idx" ON "LegalDocument"("chainFromId");

DO $$ BEGIN
  ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_chainFromId_fkey"
    FOREIGN KEY ("chainFromId") REFERENCES "LegalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
