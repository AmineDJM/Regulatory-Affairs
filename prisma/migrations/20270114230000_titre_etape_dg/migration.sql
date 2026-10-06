-- « Enlève "grosses dépenses" » (Direction, 06/10) : l'étape du Directeur Général s'intitule « Validation du Directeur
-- Général ». Seul le titre d'origine est renommé — un titre déjà retouché par le Super Admin reste le sien. L'historique
-- des décisions (`WorkflowStepEvent.stepTitle`) garde le libellé du jour où elles ont été prises.
UPDATE "WorkflowStep"
SET "title" = 'Validation du Directeur Général'
WHERE "title" = 'Validation du Directeur Général (grosses dépenses)';