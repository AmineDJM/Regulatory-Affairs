-- LE CENTRE DE PAIEMENT — l'autorisation du sommet au-dessus de 50 000 DZD.
--
-- Aucun décaissement à partir du seuil ne quitte les Finances sans être passé par le centre, tenu
-- par le PDG et le Super Admin. Les moyens généraux sont exemptés, la paie n'entre pas dans ce
-- circuit. Le centre AUTORISE, il ne paie pas : la comptabilité exécute ensuite — séparer les deux
-- gestes est ce qui rend le contrôle réel.
--
-- `NOT_REQUIRED` par défaut : les ordres DÉJÀ ÉMIS au moment du déploiement ne sont pas gelés
-- rétroactivement. C'est voulu — bloquer d'un coup tous les paiements en cours arrêterait
-- l'entreprise. Seuls les nouveaux ordres passent par le centre.

ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "centralStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "centralDecidedById" TEXT;
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "centralDecidedAt" TIMESTAMP(3);
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "centralProposedAmount" DECIMAL(14,2);

CREATE INDEX IF NOT EXISTS "ExpenseOrder_centralStatus_idx" ON "ExpenseOrder"("centralStatus");

-- LE FIL DE LA DÉCISION. Une autorisation n'est pas toujours « oui » ou « non » : le centre demande
-- une révision du montant ou une argumentation, le demandeur répond, et cela fait plusieurs
-- allers-retours. Sans endroit pour l'écrire, cet échange part en messagerie et se sépare du
-- paiement : six mois plus tard, l'ordre dit « autorisé » et personne ne sait à quelles conditions.
CREATE TABLE IF NOT EXISTS "PaymentCentreMessage" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "decision" TEXT,
  "body" TEXT NOT NULL,
  "authorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentCentreMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentCentreMessage_orderId_idx" ON "PaymentCentreMessage"("orderId");

DO $$ BEGIN
  ALTER TABLE "PaymentCentreMessage" ADD CONSTRAINT "PaymentCentreMessage_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "ExpenseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `SET NULL` : désactiver un compte ne doit pas effacer ce qu'il a écrit sur un décaissement.
DO $$ BEGIN
  ALTER TABLE "PaymentCentreMessage" ADD CONSTRAINT "PaymentCentreMessage_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
