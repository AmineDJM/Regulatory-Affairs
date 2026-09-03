-- ════════════════════════════════════════════════════════════════════════════════════════════
-- UNE FACTURE EST UN DOCUMENT LÉGAL DE NATURE « FACTURE » — pas un registre à part.
--
-- ── LE DÉFAUT QU'ON CORRIGE ─────────────────────────────────────────────────────────────────
--
-- Les factures avaient leur écran, leur table et leur vocabulaire. Legal, lui, tenait déjà la
-- chaîne d'achat entière — devis → bon de commande → FACTURE → règlement : la nature `INVOICE`
-- existait dans `LegalDocKind`, le chaînage (`chainFromId`) la prévoyait, l'envoi au règlement
-- (`expenseOrderId`) ne marchait QUE sur elle, et le circuit des pièces réclamées y versait déjà
-- les factures acceptées. Deux tables décrivaient donc le même objet, et « quelles factures de ce
-- fournisseur ? » avait deux réponses — sans qu'on sache laquelle est complète (§17 : pas de
-- second registre).
--
-- ── LA REPRISE GARDE L'IDENTIFIANT ──────────────────────────────────────────────────────────
--
-- Chaque facture devient un `LegalDocument` PORTANT SON PROPRE ID. Ce n'est pas une commodité :
-- les pièces jointes, les liens d'affaire et le journal d'audit désignent les factures par cet
-- identifiant. Le régénérer aurait transformé chaque pièce jointe en orphelin silencieux — le
-- PDF resterait en base, plus aucun écran ne le montrerait.
--
-- ── CE QUE LE VOCABULAIRE PERD, ET OÙ IL VA ─────────────────────────────────────────────────
--
--   number     → reference        title  → title        issueDate → startDate
--   dueDate    → endDate          amount → amount       paidDate  → paidDate
--   direction  → direction        transactionId → settlementTxId
--   recipient / payer → counterparty (celui des deux qui n'est PAS nous, choisi par le sens,
--                       comme le faisait déjà l'écriture comptable) ; LA PAIRE COMPLÈTE PART
--                       DANS LES NOTES — c'est justement ce qu'on vient revérifier des mois
--                       plus tard, et un champ fusionné qui efface l'autre ment.
--   status     → `LegalDocStatus` ne dit PAS l'argent : ACTIVE, sauf CANCELLED qui se conserve.
--                Le règlement se lit sur `paidDate`, seul et sans contradiction possible.
--                PARTIAL n'a pas d'équivalent : il est ÉCRIT dans les notes plutôt que perdu.
--
-- Les pièces jointes DÉMÉNAGENT (`Document.entityType` INVOICE → LEGAL_DOCUMENT) : sans cela,
-- la fiche du document légal n'afficherait pas le PDF de la facture qu'elle est.
--
-- Les LIENS D'AFFAIRE (`EntityLink`) gardent la nature INVOICE, et c'est délibéré : le graphe des
-- liens dit qu'une facture se relie à SON BON DE COMMANDE et non au contrat (le contrat s'en
-- déduit par le bon). Cette règle de flux est du savoir métier ; la remplacer par LEGAL_DOCUMENT
-- l'effacerait. `INVOICE` y désigne désormais « un document légal de nature facture », et
-- `linkHref` mène à sa fiche.
--
-- La table `Invoice` est SUPPRIMÉE après vérification arithmétique du report — la laisser en
-- place recréerait le second registre que ce lot ferme.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. Ce qu'une facture apporte au document légal ──────────────────────────────────────────
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "direction" TEXT;
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "paidDate" TIMESTAMP(3);
ALTER TABLE "LegalDocument" ADD COLUMN IF NOT EXISTS "settlementTxId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LegalDocument_settlementTxId_key" ON "LegalDocument" ("settlementTxId");
CREATE INDEX IF NOT EXISTS "LegalDocument_paidDate_idx" ON "LegalDocument" ("paidDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LegalDocument_settlementTxId_fkey') THEN
    ALTER TABLE "LegalDocument"
      ADD CONSTRAINT "LegalDocument_settlementTxId_fkey"
      FOREIGN KEY ("settlementTxId") REFERENCES "FinanceTransaction"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- ── 2. La reprise, puis la suppression du second registre ───────────────────────────────────
DO $$
DECLARE
  n_source INTEGER;
  n_reporte INTEGER;
BEGIN
  -- Déjà passée : la table n'existe plus. Rejouer la migration ne doit rien casser.
  IF to_regclass('public."Invoice"') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "LegalDocument" (
    "id", "custom", "companyId", "reference", "title", "kind", "counterparty",
    "startDate", "endDate", "status", "amount", "notes", "cancelledAt", "cancelReason",
    "direction", "paidDate", "settlementTxId",
    "sourceType", "sourceId", "createdById", "updatedById", "createdAt", "updatedAt"
  )
  SELECT
    i."id",
    i."custom",
    i."companyId",
    NULLIF(TRIM(i."number"), ''),
    i."title",
    'INVOICE'::"LegalDocKind",
    -- LA PARTIE EN FACE — celle des deux qui n'est pas nous, désignée par le SENS. C'est le
    -- choix que faisait déjà l'écriture comptable : le report ne le contredit pas.
    COALESCE(
      NULLIF(TRIM(CASE WHEN i."direction" = 'IN' THEN i."payer" ELSE i."recipient" END), ''),
      NULLIF(TRIM(CASE WHEN i."direction" = 'IN' THEN i."recipient" ELSE i."payer" END), '')
    ),
    i."issueDate",
    i."dueDate",
    -- L'ARGENT NE SE DIT PLUS DANS LE STATUT. `LegalDocStatus` porte la vie du document ;
    -- « payée » se lit sur `paidDate`, et deux champs ne peuvent donc plus se contredire.
    CASE WHEN i."status"::text = 'CANCELLED' THEN 'CANCELLED'::"LegalDocStatus" ELSE 'ACTIVE'::"LegalDocStatus" END,
    i."amount",
    NULLIF(
      BTRIM(
        COALESCE(i."notes", '')
        || CASE
             WHEN COALESCE(NULLIF(TRIM(i."recipient"), ''), NULLIF(TRIM(i."payer"), '')) IS NULL THEN ''
             ELSE E'\n' || 'Facture reprise — destinataire : ' || COALESCE(NULLIF(TRIM(i."recipient"), ''), '—')
                  || ' · payeur : ' || COALESCE(NULLIF(TRIM(i."payer"), ''), '—')
           END
        || CASE
             WHEN i."status"::text = 'PARTIAL' THEN E'\n' || 'Règlement PARTIEL au moment de la reprise (à solder).'
             ELSE ''
           END
      ),
      ''
    ),
    CASE WHEN i."status"::text = 'CANCELLED' THEN i."updatedAt" ELSE NULL END,
    CASE WHEN i."status"::text = 'CANCELLED' THEN 'Facture annulée — reprise du registre des factures.' ELSE NULL END,
    CASE WHEN i."direction" = 'IN' THEN 'IN' ELSE 'OUT' END,
    i."paidDate",
    i."transactionId",
    i."sourceType",
    i."sourceId",
    i."createdById",
    i."updatedById",
    i."createdAt",
    i."updatedAt"
  FROM "Invoice" i
  -- L'identifiant est CONSERVÉ : rejouer la reprise ne crée pas un doublon, elle ne fait rien.
  WHERE NOT EXISTS (SELECT 1 FROM "LegalDocument" d WHERE d."id" = i."id");

  -- LES PIÈCES SUIVENT LEUR FACTURE. Sans ce déménagement, le PDF resterait en base et la fiche
  -- du document légal serait vide — le défaut le plus coûteux d'une fusion de registres.
  UPDATE "Document" doc
     SET "entityType" = 'LEGAL_DOCUMENT'::"EntityType"
   WHERE doc."entityType" = 'INVOICE'::"EntityType"
     AND EXISTS (SELECT 1 FROM "Invoice" i WHERE i."id" = doc."entityId");

  -- ARITHMÉTIQUE AVANT DESTRUCTION : on ne supprime que ce qu'on a vérifié avoir reporté.
  SELECT COUNT(*) INTO n_source FROM "Invoice";
  SELECT COUNT(*) INTO n_reporte
    FROM "Invoice" i JOIN "LegalDocument" d ON d."id" = i."id" AND d."kind" = 'INVOICE'::"LegalDocKind";
  IF n_reporte <> n_source THEN
    RAISE EXCEPTION 'Reprise des factures incomplète : % facture(s) sur % reportée(s) — la table est CONSERVÉE.', n_reporte, n_source;
  END IF;

  DROP TABLE "Invoice";
END $$;

-- Le statut d'une facture n'existe plus : il se lit sur `paidDate` et sur `LegalDocStatus`.
DROP TYPE IF EXISTS "InvoiceStatus";
