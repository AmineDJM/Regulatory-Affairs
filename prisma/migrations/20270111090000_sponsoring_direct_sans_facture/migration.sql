-- SPONSORING DIRECT : LA FACTURE N'EST PLUS EXIGÉE POUR LE PAIEMENT (Direction, 05/10).
--
-- « Quand c'est un sponsoring direct (à l'association), ça demande « Proforma / lettre de demande de
-- sponsoring », la facture n'est pas obligatoire. »
--
-- La règle se lit sur `ExpenseOrder.requiresInvoice`, posée à la naissance de l'ordre : le règlement,
-- la colonne « Facture » des règlements à effectuer et le signal « justificatif manquant » la lisent
-- tels quels. Les ordres NÉS ensuite la portent à faux (le poste d'un versement à l'association le dit
-- à la création). Cette migration ne règle que les ordres DÉJÀ nés et pas encore réglés — un ordre
-- réglé est un fait, on ne réécrit pas son histoire — et seulement ceux d'un poste « versement à
-- l'association » : l'ordre d'un autre poste du même sponsoring (une prestation, un BC) garde sa facture.
--
-- Idempotente : relancée, elle ne retouche que ce qui exige encore une facture.

UPDATE "ExpenseOrder" o
   SET "requiresInvoice" = false
 WHERE o."requiresInvoice" = true
   AND o."status" IN ('PENDING', 'REVISION_REQUESTED')
   AND EXISTS (
     SELECT 1 FROM "AdProItem" i
      WHERE i."expenseOrderId" = o."id"
        AND i."kind" = 'ASSOCIATION_SUPPORT'
   );
