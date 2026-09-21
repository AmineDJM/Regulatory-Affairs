-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Ad & Pro — L'ORDRE S'INVERSE, ET DIRECTION MARKETING TRANCHE (§118.138)
--
-- Décision de la Direction (09/2026) : « toutes les Ad&Pro, hors matériel promotionnel, devront
-- passer par Direction des opérations PUIS Direction Marketing à la fin, et pas l'inverse comme
-- c'est le cas maintenant. C'est d'ailleurs le mot de la Direction Marketing qui est définitif,
-- et elle choisit le budget dans lequel l'accorder. » Et, orthogonalement : « à partir de
-- 1 000 000 DZD, la validation du DG, mais ce seuil doit pouvoir être configuré. »
--
-- ── POURQUOI CETTE MIGRATION TOUCHE LES DÉFINITIONS DÉJÀ EN BASE ─────────────────────────
--
-- `defaults.ts` n'est semé QUE si aucune définition n'existe pour la catégorie. En changer la
-- graine ne change donc RIEN là où le circuit tourne déjà, c'est-à-dire en production. La règle
-- doit être appliquée aux définitions vivantes (§118.107).
--
-- ── CE QU'ELLE NE TOUCHE PAS, ET POURQUOI ────────────────────────────────────────────────
--
-- 1. LES CIRCUITS REMODELÉS. On n'agit que sur les définitions dont l'ensemble des étapes est
--    EXACTEMENT la colonne vertébrale (`preliminary`, `final`, `marketing`, plus `dg` si un
--    second passage a déjà eu lieu). Un Super Admin qui a ajouté ou retiré une étape a pris une
--    décision ; renuméroter ses positions à l'aveugle déplacerait SON étape derrière l'étape
--    décisive, donc la rendrait inatteignable — en silence. Ces circuits-là se réordonnent dans
--    le constructeur, où l'on voit ce qu'on déplace.
--
-- 2. `WorkflowInstance.finalSlug`. Une instance née sous l'ancienne règle porte parfois
--    `finalSlug = 'marketing'` (la demande d'un KAM, tranchée par Direction Marketing). Or
--    `marketing` DEVIENT la dernière étape : borne posée sur la dernière étape et absence de
--    borne donnent exactement le même parcours, la même terminalité et la même queue coupée
--    (vide). Réécrire ce champ n'aurait rien changé et aurait touché une donnée que le moteur
--    fige délibérément à la naissance.
--
-- 3. LES MONTANTS ET LES DÉCISIONS DÉJÀ PRIS. Rien n'est recalculé : une demande approuvée hier
--    reste approuvée, avec le montant qu'on lui a accordé.
--
-- Idempotente : chaque instruction est bornée par une condition qui la rend sans effet au
-- second passage.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. LE SEUIL DU DIRECTEUR GÉNÉRAL — un seul chiffre, pour les cinq circuits ───────────
ALTER TABLE "AppSetting"
  ADD COLUMN IF NOT EXISTS "adProDgThreshold" DECIMAL(14,2) NOT NULL DEFAULT 1000000;

-- ─── 2. LIBÉRER LES RANGS AVANT D'INSÉRER — `(definitionId, position)` est UNIQUE ─────────
--
-- La première version de cette migration insérait la porte du DG au rang 1, que `marketing`
-- occupait déjà : « duplicate key value violates unique constraint
-- WorkflowStep_definitionId_position_key ». Mesuré en tentant le déploiement, pas deviné — la
-- contrainte n'est pas déclarée sur le modèle Prisma mais posée par une migration antérieure,
-- et aucune relecture du schéma ne l'aurait dit.
--
-- On décale donc TOUTE la colonne vertébrale de +100 : l'incrément est le même pour tous, donc
-- les rangs restent distincts à chaque instant, et les rangs 0 à 3 se libèrent d'un coup.
UPDATE "WorkflowStep" s
SET "position" = s."position" + 100
FROM "WorkflowDefinition" d
WHERE s."definitionId" = d."id"
  AND s."slug" IN ('preliminary','dg','final','marketing')
  AND s."position" < 100
  AND NOT EXISTS (
    SELECT 1 FROM "WorkflowStep" x
    WHERE x."definitionId" = d."id" AND x."slug" NOT IN ('preliminary','dg','final','marketing')
  );

-- ─── 3. LA PORTE DU DIRECTEUR GÉNÉRAL — insérée dans chaque circuit Ad & Pro ──────────────
--
-- Position 1 (juste après le préliminaire). Elle n'a PAS de `autoSkipMaxAmount` : le seuil
-- GLOBAL ci-dessus la gouverne (`seuilFranchissement`), et l'y recopier en ferait une seconde
-- vérité figée au jour de la migration (§118.5).
INSERT INTO "WorkflowStep" (
  "id", "definitionId", "position", "slug", "title", "description",
  "actorRoles", "actorScope", "powers",
  "requireAmount", "requireCategory", "requireNote",
  "emitDeclaration", "emitExpenseOrder", "notifyRoles",
  "optional", "confidential", "legacyStatus", "autoApproveIfRequester"
)
SELECT
  'dgstep_' || d."id",
  d."id",
  1,
  'dg',
  'Validation du Directeur Général (grosses dépenses)',
  'Au-delà du seuil réglé en Administration › Réglages, le Directeur Général valide en plus. En dessous, l''étape est franchie automatiquement et tracée.',
  ARRAY['GENERAL_MANAGER']::TEXT[],
  'ROLE',
  ARRAY['APPROVE','REJECT','COMMENT']::TEXT[],
  FALSE, FALSE, FALSE,
  FALSE, FALSE, ARRAY['GENERAL_MANAGER','SUPER_ADMIN']::TEXT[],
  FALSE, FALSE, 'PRELIMINARY_APPROVED', FALSE
FROM "WorkflowDefinition" d
WHERE EXISTS (SELECT 1 FROM "WorkflowStep" s WHERE s."definitionId" = d."id" AND s."slug" = 'marketing')
  AND NOT EXISTS (SELECT 1 FROM "WorkflowStep" s WHERE s."definitionId" = d."id" AND s."slug" = 'dg')
  -- Colonne vertébrale INTACTE, et elle seule (voir l'en-tête, point 1).
  AND NOT EXISTS (
    SELECT 1 FROM "WorkflowStep" s
    WHERE s."definitionId" = d."id" AND s."slug" NOT IN ('preliminary','dg','final','marketing')
  );

-- ─── 4. L'ORDRE — Direction des opérations AVANT Direction Marketing ──────────────────────
UPDATE "WorkflowStep" s
SET "position" = CASE s."slug"
      WHEN 'preliminary' THEN 0
      WHEN 'dg'          THEN 1
      WHEN 'final'       THEN 2
      WHEN 'marketing'   THEN 3
    END
FROM "WorkflowDefinition" d
WHERE s."definitionId" = d."id"
  AND s."slug" IN ('preliminary','dg','final','marketing')
  AND NOT EXISTS (
    SELECT 1 FROM "WorkflowStep" x
    WHERE x."definitionId" = d."id" AND x."slug" NOT IN ('preliminary','dg','final','marketing')
  );

-- ─── 5. DIRECTION MARKETING TRANCHE : le budget, la catégorie, et les émissions ───────────
--
-- Elle cesse d'être CONFIDENTIELLE : cette étape ne rend plus un avis en attente d'une décision
-- d'en haut, elle EST la décision, et un budget accordé se lit par celui à qui on l'accorde.
UPDATE "WorkflowStep" s
SET "title"            = 'Décision et budget (Direction Marketing)',
    "description"      = 'Direction Marketing TRANCHE : montant accordé + (sous-)catégorie budgétaire obligatoires. Sa décision est définitive et lance l''information médicale (PRIM) puis l''ordre de dépense.',
    "powers"           = ARRAY['APPROVE','REJECT','SET_AMOUNT','SET_CATEGORY','COMMENT']::TEXT[],
    "requireAmount"    = TRUE,
    "requireCategory"  = TRUE,
    "confidential"     = FALSE,
    "emitDeclaration"  = TRUE,
    "emitExpenseOrder" = TRUE,
    "legacyStatus"     = 'AWAITING_FINAL',
    "notifyRoles"      = ARRAY['PRODUCT_MANAGER','SUPER_ADMIN']::TEXT[]
FROM "WorkflowDefinition" d
WHERE s."definitionId" = d."id"
  AND s."slug" = 'marketing'
  AND NOT EXISTS (
    SELECT 1 FROM "WorkflowStep" x
    WHERE x."definitionId" = d."id" AND x."slug" NOT IN ('preliminary','dg','final','marketing')
  );

-- ─── 6. LA DIRECTION VALIDE, ELLE NE CHIFFRE PLUS ────────────────────────────────────────
--
-- Le montant et la catégorie budgétaire appartiennent désormais à Direction Marketing. Les
-- drapeaux d'émission QUITTENT cette étape : les laisser ici émettrait l'ordre de dépense AVANT
-- que le montant ne soit arrêté — l'argent engagé sur un chiffre que personne n'a encore fixé.
UPDATE "WorkflowStep" s
SET "title"            = 'Validation (Direction des opérations)',
    "description"      = 'La Direction donne son accord sur l''opération. Le montant et la sous-catégorie budgétaire ne se décident PAS ici : ils appartiennent à Direction Marketing, qui tranche ensuite.',
    "powers"           = ARRAY['APPROVE','REJECT','COMMENT']::TEXT[],
    "requireAmount"    = FALSE,
    "requireCategory"  = FALSE,
    "confidential"     = FALSE,
    "emitDeclaration"  = FALSE,
    "emitExpenseOrder" = FALSE,
    "legacyStatus"     = 'PRELIMINARY_APPROVED'
FROM "WorkflowDefinition" d
WHERE s."definitionId" = d."id"
  AND s."slug" = 'final'
  AND NOT EXISTS (
    SELECT 1 FROM "WorkflowStep" x
    WHERE x."definitionId" = d."id" AND x."slug" NOT IN ('preliminary','dg','final','marketing')
  );
