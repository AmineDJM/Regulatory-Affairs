-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- SPONSORING — PRÉ-VALIDATION DE LA TENUE, POSTES, PUIS VALIDATION FINALE ET CLÔTURE (§118.151)
--
-- La Direction : « quand quelqu'un crée une demande, on lui demande un sponsoring demandé par le
-- médecin et un sponsoring suggéré par le délégué. Ce sponsoring s'ajoute automatiquement dans un
-- poste — direct (à l'association) ou indirect (prise en charge de prestations / médecins). Une
-- fois validé par le National Sales et le Directeur des opérations, la Direction Marketing
-- PRÉ-VALIDE ou refuse la tenue de l'événement. Si elle pré-valide, on passe aux postes — devis
-- à l'assistante de direction, BC, factures. Une fois l'événement complété, la Direction
-- Marketing valide tout, met chaque poste dans un budget, valide et clôture. »
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS ───────────────────────────────────────────────────
--
-- Elle ne change le statut d'AUCUNE demande et ne recalcule AUCUN montant : une demande accordée
-- hier sous l'ancien circuit reste accordée, avec son montant. Seules les décisions À VENIR
-- suivent la nouvelle règle.
--
-- Elle n'agit que sur l'étape `marketing` du circuit SPONSORING, et seulement si elle porte encore
-- le titre de la graine précédente : un Super Admin qui l'a remodelée a pris une décision, et ce
-- n'est pas une migration qui la défait.
--
-- Idempotente : chaque instruction est sans effet au second passage.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. Les nouveaux états et natures ────────────────────────────────────────────────────
ALTER TYPE "SponsoringStatus" ADD VALUE IF NOT EXISTS 'PRE_VALIDATED';
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'INDIRECT_SUPPORT';

DO $$ BEGIN
  CREATE TYPE "SponsoringNature" AS ENUM ('DIRECT', 'INDIRECT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. La demande porte sa nature, et sa clôture ─────────────────────────────────────────
ALTER TABLE "SponsoringRequest" ADD COLUMN IF NOT EXISTS "nature" "SponsoringNature";
ALTER TABLE "SponsoringRequest" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "SponsoringRequest" ADD COLUMN IF NOT EXISTS "closedById" TEXT;
ALTER TABLE "SponsoringRequest" ADD COLUMN IF NOT EXISTS "closingNote" TEXT;

-- ─── 3. L'étape de la Direction Marketing devient la PRÉ-VALIDATION DE LA TENUE ──────────
--
-- Plus de montant ni de catégorie à cette étape : l'argent se décide POSTE par poste, puis à la
-- validation finale. Plus d'ordre de dépense global non plus — ce sont les postes qui portent la
-- dépense (BC puis facture), et un ordre global en plus la ferait payer deux fois. La déclaration
-- d'information médicale (PRIM), elle, part toujours à cette décision : c'est l'événement qui se
-- déclare, et il est décidé ici.
UPDATE "WorkflowStep" s
SET "title"            = 'Pré-validation de la tenue (Direction Marketing)',
    "description"      = 'La Direction Marketing pré-valide ou refuse la TENUE de l''événement. Pré-validée, la demande passe aux postes (devis, BC, factures), puis à la validation finale qui range chaque poste dans un budget et clôture la demande.',
    "powers"           = ARRAY['APPROVE','REJECT','COMMENT']::TEXT[],
    "requireAmount"    = FALSE,
    "requireCategory"  = FALSE,
    "emitExpenseOrder" = FALSE,
    "emitDeclaration"  = TRUE
FROM "WorkflowDefinition" d
WHERE s."definitionId" = d."id"
  AND d."category" = 'SPONSORING'
  AND s."slug" = 'marketing'
  AND s."title" = 'Décision et budget (Direction Marketing)';
