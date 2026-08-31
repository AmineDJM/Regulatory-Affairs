-- La check-list de présoumission devient l'ÉTAPE 2 du processus ANPP (clé `presub_checklist`
-- dans le JSON `workflow`). Un dossier DÉPOSÉ a nécessairement passé sa présoumission — et donc
-- sa check-list : on coche l'étape sur ces dossiers-là. Sans ce rattrapage, un dossier fini
-- afficherait « prochaine étape : 2. Check-list de présoumission » — la réapparition du bug
-- « complet mais prochaine étape : 1 » déjà corrigé une fois (Raltegravir).
--
-- Idempotent : ne touche que les lignes où l'étape n'est pas déjà « DONE », et FUSIONNE avec
-- une éventuelle entrée existante (note conservée) plutôt que de la remplacer.
UPDATE "RegulatoryProduct"
SET "workflow" = jsonb_set(
  "workflow"::jsonb,
  '{presub_checklist}',
  COALESCE("workflow"::jsonb -> 'presub_checklist', '{}'::jsonb) || '{"status": "DONE"}'::jsonb,
  true
)
WHERE "workflow" IS NOT NULL
  AND "workflow"::jsonb -> 'depot' ->> 'status' = 'DONE'
  AND COALESCE("workflow"::jsonb -> 'presub_checklist' ->> 'status', '') <> 'DONE';
