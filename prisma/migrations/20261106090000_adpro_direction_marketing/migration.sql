-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Ad & Pro — LE CHEF DE PRODUIT DEVIENT DIRECTION MARKETING, ET LE PARCOURS DÉPEND DU DEMANDEUR
--
-- Décision de la Direction : une demande de KAM passe par le National Sales puis est TRANCHÉE
-- par Direction Marketing ; celle de tout autre demandeur — le National Sales compris — passe
-- par Direction Marketing puis la Direction. Le budget et le choix de la sous-catégorie
-- budgétaire appartiennent désormais à Direction Marketing, plus à la Direction.
--
-- ── POURQUOI CETTE MIGRATION TOUCHE LES DÉFINITIONS DÉJÀ EN BASE ─────────────────────────
--
-- `defaults.ts` n'est semé QUE si aucune définition n'existe pour la catégorie (`getDefinition`
-- renvoie l'existante). En changer la graine ne change donc RIEN là où le circuit tourne déjà,
-- c'est-à-dire en production. La règle doit être appliquée aux définitions vivantes.
--
-- ── ET POURQUOI IL N'Y A AUCUNE LISTE DE CATÉGORIES ICI ─────────────────────────────────
--
-- La première version de cette migration filtrait sur
-- `category IN ('SPONSORING','CONGRESS_INTERNATIONAL','CONGRESS_NATIONAL','EVENT')`. La
-- quatrième valeur est FAUSSE : la catégorie s'appelle `EVENTS` — `EVENT` est l'EntityType de
-- son entité source (`CATEGORY_ENTITY.EVENTS = "EVENT"`), et les deux se ressemblent assez pour
-- qu'on écrive l'un en pensant l'autre. Mesuré : la définition « Événements » n'a PAS été
-- migrée, et la migration a rapporté un succès. Une liste écrite à la main est fausse le jour où
-- quelqu'un ajoute une valeur — celle-ci l'était dès le premier jour, en silence (§118.73).
--
-- Le filtre était de la REDONDANCE, et une redondance qui peut être fausse coûte plus qu'elle ne
-- protège : `WORKFLOW_CATEGORIES` ne contient QUE les quatre circuits Ad & Pro, donc toute
-- `WorkflowDefinition` en est un. On cible par le FAIT structurel — l'étape porte le slug
-- `analysis`, `final` ou `preliminary` de la colonne vertébrale Ad & Pro — et plus par un nom
-- qu'il faudrait tenir à jour.
--
-- Idempotente : chaque instruction est bornée par une condition qui la rend sans effet au
-- second passage.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. La borne de sortie du parcours (null = la dernière étape, comportement d'avant) ───
ALTER TABLE "WorkflowInstance" ADD COLUMN IF NOT EXISTS "finalSlug" TEXT;

-- ─── 2. L'historique et les instances SUIVENT le renommage ─────────────────────────────────
--
-- Le caviardage de l'avis confidentiel se fait par SLUG
-- (`confidentialSlugs.has(e.stepSlug)`). Renommer l'étape sans renommer ses événements passés
-- rendrait tous les avis historiques VISIBLES au demandeur du jour au lendemain — une régression
-- de permission introduite par un renommage. Les trois porteurs du slug bougent donc ensemble :
-- l'historique, l'instance qui s'y trouve, et l'étape elle-même (dans cet ordre : la jointure
-- passe par le slug, qui va changer).
UPDATE "WorkflowStepEvent"
   SET "stepSlug" = 'marketing',
       "stepTitle" = 'Arbitrage et budget (Direction Marketing)'
 WHERE "stepSlug" = 'analysis';

UPDATE "WorkflowInstance" SET "currentSlug" = 'marketing' WHERE "currentSlug" = 'analysis';

-- ─── 3. L'étape « analyse du chef de produit » devient l'arbitrage de Direction Marketing ───
--
-- La portée passe d'ASSIGNEE à ROLE : Direction Marketing est une DIRECTION, pas une personne
-- qu'on désigne. Garder ASSIGNEE alors que le parcours de tout demandeur non-KAM commence ICI
-- laisserait une étape que PERSONNE ne peut franchir — la demande morte à sa première étape,
-- sans une seule ligne d'échec.
UPDATE "WorkflowStep"
   SET "slug" = 'marketing',
       "title" = 'Arbitrage et budget (Direction Marketing)',
       "description" = 'Direction Marketing arbitre la demande : montant accordé + (sous-)catégorie budgétaire obligatoires. Avis confidentiel tant que la Direction n''a pas tranché ; pour une demande de KAM, c''est ICI que la décision est prise et le budget accordé devient visible du demandeur.',
       "actorScope" = 'ROLE',
       "actorRoles" = ARRAY['PRODUCT_MANAGER']::TEXT[],
       "powers" = ARRAY['APPROVE', 'REJECT', 'SET_AMOUNT', 'SET_CATEGORY', 'COMMENT']::TEXT[],
       "requireAmount" = TRUE,
       "requireCategory" = TRUE,
       "confidential" = TRUE,
       "notifyRoles" = ARRAY['PRODUCT_MANAGER']::TEXT[]
 WHERE "slug" = 'analysis';

-- ─── 4. La Direction TRANCHE, elle ne fixe plus le budget ───────────────────────────────────
UPDATE "WorkflowStep"
   SET "title" = 'Validation définitive (Direction)',
       "description" = 'La Direction tranche : accord ou refus sur le budget arbitré par Direction Marketing. La validation lance l''information médicale (PRIM) puis l''ordre de dépense.',
       "powers" = ARRAY['APPROVE', 'REJECT', 'COMMENT']::TEXT[],
       "requireAmount" = FALSE,
       "requireCategory" = FALSE
 WHERE "slug" = 'final'
   AND 'SET_AMOUNT' = ANY ("powers");

-- ─── 5. Le National Sales approuve — il ne désigne plus ─────────────────────────────────────
--
-- La désignation existait pour remplir une étape à portée ASSIGNEE. Cette étape est désormais
-- portée par un RÔLE : exiger une désignation serait une friction sans destinataire, et le
-- moteur refuse l'approbation tant qu'aucune personne n'est désignée (`powers` contient ASSIGN).
UPDATE "WorkflowStep"
   SET "powers" = ARRAY['APPROVE', 'REJECT', 'COMMENT']::TEXT[],
       "assignRole" = NULL,
       "description" = 'Le National Sales approuve ou refuse la demande de son KAM avant qu''elle n''atteigne Direction Marketing.'
 WHERE "slug" = 'preliminary'
   AND 'ASSIGN' = ANY ("powers");
