-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE RÈGLEMENT N'A PLUS QUE TROIS ÉTATS, ET LA DEMANDE DE PAIEMENT PORTE ENFIN SA JUSTIFICATION.
--
-- Trois changements, qui vont ensemble parce qu'ils décrivent le même trajet de l'argent :
--
--  1. AU DÉCAISSEMENT — les Finances n'annulent plus, ne demandent plus de révision de budget,
--     ne rouvrent plus rien. L'ordre leur arrive AUTORISÉ par le centre de paiement, qui a vu le
--     montant, la file entière et l'engagement. Il ne reste que la question du décaissement, qui
--     a trois réponses : non payé (défaut), paiement REPORTÉ À une date, payé.
--
--     Le report est une DATE et non un statut. Un statut « reporté » obligerait quelqu'un à le
--     remettre à « non payé » le jour venu ; ce quelqu'un oublierait. Une date expire seule.
--
--  2. À LA DEMANDE — un bon de commande OU une facture devient obligatoire, avec la déclaration
--     que le MOYEN DE PAIEMENT figure sur le document. Le bon de versement (information
--     médicale) en est exempté : il n'a ni bon ni facture, et sa quittance n'existe qu'APRÈS le
--     versement — l'exiger avant reviendrait à exiger la preuve d'un paiement pour l'autoriser.
--
--  3. L'ÉCHÉANCE SE QUALIFIE — fixe non négociable, importante, moyenne. Deux dates identiques
--     ne pèsent pas la même chose, et la file les traitait à l'identique.
--
-- Idempotent : rejouable sans effet de bord.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────── 1. La nature de l'échéance ───────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentDeadlineNature') THEN
    CREATE TYPE "PaymentDeadlineNature" AS ENUM ('MODERATE', 'IMPORTANT', 'FIXED');
  END IF;
END $$;

ALTER TABLE "PaymentRequest"
  ADD COLUMN IF NOT EXISTS "deadlineNature" "PaymentDeadlineNature" NOT NULL DEFAULT 'MODERATE';

-- ─────────────────────── 2. La demande porte sa justification ───────────────────────
-- `paymentMethodStated` part à FALSE, y compris sur les demandes existantes : personne n'a
-- coché cette case, et la mettre à TRUE d'office inventerait une déclaration que personne n'a
-- faite. Les demandes DÉJÀ transmises ne sont pas rouvertes pour autant — la règle ne s'applique
-- qu'au moment de transmettre, et elles l'ont déjà été.
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "paymentMethodStated" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "contactName"  TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

-- ─────────────────────── 3. Le report de paiement ───────────────────────
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "deferredUntil"  TIMESTAMP(3);
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "deferredReason" TEXT;
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "deferredById"   TEXT;
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "deferredAt"     TIMESTAMP(3);
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "deadlineNature" TEXT;

CREATE INDEX IF NOT EXISTS "ExpenseOrder_deferredUntil_idx" ON "ExpenseOrder" ("deferredUntil");

-- La nature déclarée redescend sur les ordres DÉJÀ nés d'une demande de paiement, pour que la
-- file des Finances la lise dès le premier jour au lieu de l'acquérir demande après demande.
UPDATE "ExpenseOrder" o
SET "deadlineNature" = p."deadlineNature"::TEXT
FROM "PaymentRequest" p
WHERE o."sourceType" = 'PAYMENT_REQUEST'
  AND o."sourceId" = p."id"
  AND o."deadlineNature" IS NULL;

-- ─────────────────────── 4. LES ORDRES EN RÉVISION REVIENNENT DANS LA FILE ───────────────────────
--
-- Le circuit de révision de budget disparaît : plus personne ne peut le demander, donc plus
-- personne ne peut le trancher. Un ordre laissé en « Révision demandée » n'aurait plus aucune
-- sortie — il attendrait indéfiniment une décision qu'aucun écran ne sait plus prendre.
--
-- Ils repassent donc « à régler », AU MONTANT AUTORISÉ PAR LE CENTRE, qui n'a jamais été modifié :
-- une révision non tranchée n'a rien changé. Le motif du comptable n'est pas perdu — il est
-- recopié dans les notes de l'ordre, où les Finances le liront au moment de payer.
UPDATE "ExpenseOrder"
SET "notes" = TRIM(BOTH E'\n' FROM COALESCE("notes" || E'\n\n', '')
      || 'Révision de budget demandée le '
      || TO_CHAR("updatedAt", 'DD/MM/YYYY')
      || ' (circuit retiré, montant maintenu) : ' || "revisionReason"),
    "status" = 'PENDING'
WHERE "status" = 'REVISION_REQUESTED'
  AND "revisionReason" IS NOT NULL;

UPDATE "ExpenseOrder" SET "status" = 'PENDING' WHERE "status" = 'REVISION_REQUESTED';
