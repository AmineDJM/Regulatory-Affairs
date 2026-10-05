-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- Ad & Pro — LA DESCRIPTION DE L'ÉTAPE « final » DIT LES DEUX ROUTES (audit 360°, vague « restes »)
--
-- La migration 20261116090000 a posé sur l'étape « Validation (Direction des opérations) » :
-- « Le montant et la sous-catégorie budgétaire ne se décident PAS ici ». C'est FAUX depuis
-- §118.197g sur la route d'une demande de rang 2 (Direction Marketing, Manager Promotion
-- médicale) : elle s'arrête à « final », et l'étape qui conclut hérite des pouvoirs d'argent des
-- étapes qu'elle n'atteint pas (`pouvoirs-argent.ts`). C'est la phrase que le Super Admin lit en
-- réglant le circuit ; elle se corrige comme une règle.
--
-- ── CE QU'ELLE NE TOUCHE PAS ─────────────────────────────────────────────────────────────
--
-- Une description qu'un Super Admin a RÉÉCRITE : on ne remplace que l'ancien texte, mot pour mot.
-- Sa phrase est une décision ; la nôtre n'en est que la valeur par défaut.
--
-- Idempotente : au second passage, plus aucune ligne ne porte l'ancien texte. Le nouveau est
-- celui de la graine (`defaults.ts`) — un test exige qu'ils restent identiques.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
UPDATE "WorkflowStep"
SET "description" = 'La Direction des opérations donne son accord sur l''opération ; d''ordinaire, Direction Marketing tranche ensuite, et le montant comme la sous-catégorie budgétaire se décident chez elle. Sur la demande d''un membre de Direction Marketing ou du Manager Promotion médicale, qui ne tranchent pas leur propre demande, cette étape conclut : elle prend alors la décision de Direction Marketing — montant accordé et sous-catégorie budgétaire compris quand le circuit les exige — et lance ce qui en découle.'
WHERE "slug" = 'final'
  AND "description" = 'La Direction donne son accord sur l''opération. Le montant et la sous-catégorie budgétaire ne se décident PAS ici : ils appartiennent à Direction Marketing, qui tranche ensuite.';
