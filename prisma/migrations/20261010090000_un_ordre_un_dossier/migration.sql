-- ════════════════════════════════════════════════════════════════════════════════════════════
-- UN ORDRE DE DÉPENSE, UN DOSSIER — d'où qu'il vienne.
--
-- Jusqu'ici, seul un ordre né d'une DEMANDE DE PAIEMENT portait un dossier : ses pièces, ses
-- verdicts, son fil, et un libellé cliquable dans la file du décaissement. Un ordre né d'un
-- matériel promotionnel, d'un bon de versement, d'un sponsoring, d'un congrès, d'un dossier
-- réglementaire ou d'une demande au secrétariat n'en portait aucun : même écran, même argent,
-- et la moitié des lignes n'étaient que du texte mort.
--
-- Cette migration fait deux choses :
--   1. elle ajoute `origin` — `REQUEST` (le dossier a créé l'ordre) ou `EXPENSE_ORDER` (l'ordre
--      a créé le dossier). Deux dossiers identiques à l'écran, deux règles de décision opposées ;
--   2. elle OUVRE RÉTROACTIVEMENT le dossier manquant des ordres déjà en base, sans quoi la
--      règle ne vaudrait que pour l'avenir et les lignes d'aujourd'hui resteraient muettes.
--
-- IDEMPOTENCE : l'identifiant du dossier compagnon est DÉRIVÉ de celui de l'ordre
-- (`pcomp_<id de l'ordre>`). Rejouer ce fichier ne crée rien une seconde fois, et l'on sait au
-- premier coup d'œil de quel ordre vient un dossier.
--
-- CE QUI N'EST PAS REPRIS, ET POURQUOI : un ordre SANS DEMANDEUR (`requestedById IS NULL`).
-- `PaymentRequest."requesterId"` n'est pas nullable, et INVENTER un demandeur — le premier
-- Super Admin venu, l'auteur de la migration — écrirait dans l'audit le nom de quelqu'un qui
-- n'a rien demandé. Ces ordres-là gardent un libellé non cliquable ; c'est une lacune HONNÊTE,
-- préférable à une attribution fausse.
-- ════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. La colonne d'origine ─────────────────────────────────────────────────────────────────
ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'REQUEST';

-- La file du décaissement lit le dossier DEPUIS l'ordre, en lot. Sans cet index, chaque écran
-- de trois cents ordres balayait la table entière.
CREATE INDEX IF NOT EXISTS "PaymentRequest_expenseOrderId_idx" ON "PaymentRequest"("expenseOrderId");

-- ── 2. Le dossier manquant des ordres déjà émis ─────────────────────────────────────────────
--
-- La numérotation continue la série PAY de CHAQUE ANNÉE — on ne repart pas à 001 sous prétexte
-- qu'il s'agit d'une reprise : deux dossiers de 2026 portant « PAY-2026-001 » seraient refusés
-- par la contrainte d'unicité, et l'un des deux ordres n'aurait toujours pas de dossier.
WITH cibles AS (
  SELECT o."id", o."label", o."notes", o."amount", o."beneficiary", o."requestedById",
         o."companyId", o."dueDate", o."deadlineNature", o."sourceType", o."sourceId",
         o."status", o."createdAt",
         date_part('year', o."createdAt")::int AS an
  FROM "ExpenseOrder" o
  WHERE o."requestedById" IS NOT NULL
    -- Un ordre né d'une demande de paiement A DÉJÀ son dossier : c'est la demande elle-même.
    AND (o."sourceType" IS NULL OR o."sourceType" <> 'PAYMENT_REQUEST')
    AND NOT EXISTS (SELECT 1 FROM "PaymentRequest" p WHERE p."id" = 'pcomp_' || o."id")
    AND NOT EXISTS (SELECT 1 FROM "PaymentRequest" p WHERE p."expenseOrderId" = o."id")
),
annees AS (
  SELECT DISTINCT c.an FROM cibles c
),
depart AS (
  SELECT a.an,
         COALESCE(MAX(NULLIF(regexp_replace(p."reference", '^PAY-[0-9]+-', ''), '')::int), 0) AS dernier
  FROM annees a
  LEFT JOIN "PaymentRequest" p
    ON p."reference" ~ ('^PAY-' || a.an || '-[0-9]+$')
  GROUP BY a.an
),
numerotees AS (
  SELECT c.*,
         d.dernier + row_number() OVER (PARTITION BY c.an ORDER BY c."createdAt", c."id") AS n
  FROM cibles c
  JOIN depart d ON d.an = c.an
)
INSERT INTO "PaymentRequest" (
  "id", "reference", "title", "description", "amount", "payee", "recipientId", "companyId",
  "dueDate", "deadlineNature", "urgency", "paymentMethodStated", "status", "requesterId",
  "entityType", "entityId", "expenseOrderId", "origin", "submittedAt", "createdAt", "updatedAt"
)
SELECT
  'pcomp_' || n."id",
  'PAY-' || n.an || '-' || lpad(n.n::text, 3, '0'),
  n."label",
  n."notes",
  n."amount",
  -- Le bénéficiaire est obligatoire sur un dossier ; beaucoup d'ordres n'en nomment pas (une
  -- avance sur salaire, un versement à une autorité). On écrit alors le libellé, qui dit au
  -- moins de quoi il s'agit — un tiret serait un faux.
  COALESCE(NULLIF(btrim(n."beneficiary"), ''), NULLIF(btrim(n."label"), ''), 'Bénéficiaire non précisé'),
  NULL,
  n."companyId",
  n."dueDate",
  (CASE WHEN n."deadlineNature" IN ('FIXED', 'IMPORTANT', 'MODERATE') THEN n."deadlineNature" ELSE 'MODERATE' END)::"PaymentDeadlineNature",
  'WHEN_POSSIBLE'::"PaymentUrgency",
  -- Le moyen de paiement n'a jamais été déclaré sur ces circuits : l'affirmer serait une
  -- attestation fausse, portée au nom du demandeur.
  false,
  -- L'ÉTAT DU DOSSIER SUIT L'ORDRE : réglé → soldé, annulé → annulé, tout le reste → chez les
  -- Finances. Un dossier « en cours » sous un paiement fait il y a six mois serait un mensonge.
  (CASE WHEN n."status" = 'PAID' THEN 'APPROVED'
        WHEN n."status" = 'CANCELLED' THEN 'CANCELLED'
        ELSE 'SUBMITTED' END)::"PaymentRequestStatus",
  n."requestedById",
  n."sourceType",
  n."sourceId",
  n."id",
  'EXPENSE_ORDER',
  n."createdAt",
  n."createdAt",
  now()
FROM numerotees n;

-- ── 3. Le fil ne s'ouvre pas vide ───────────────────────────────────────────────────────────
--
-- Un dossier dont l'historique est blanc laisse croire qu'il ne s'est rien passé. La première
-- ligne dit d'où il vient — et pourquoi personne ne l'a « déposé ».
INSERT INTO "PaymentRequestEvent" ("id", "requestId", "actorId", "kind", "message", "at")
SELECT 'pcompev_' || p."id", p."id", NULL, 'SUBMIT',
       'Dossier ouvert automatiquement avec l''ordre de dépense — le circuit d''origine avait déjà validé la dépense.',
       p."createdAt"
FROM "PaymentRequest" p
WHERE p."origin" = 'EXPENSE_ORDER'
  AND NOT EXISTS (SELECT 1 FROM "PaymentRequestEvent" e WHERE e."id" = 'pcompev_' || p."id");
