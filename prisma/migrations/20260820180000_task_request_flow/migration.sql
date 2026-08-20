-- Tâches nées d'une DEMANDE : acceptation / refus motivé, puis travail validé sur place.
--
-- `requestedAt` distingue une tâche DEMANDÉE d'une tâche ordinaire créée directement : c'est
-- lui qui supprime les étapes intermédiaires (démarrer, mettre dans un projet) une fois la
-- demande acceptée. `declineReason` reste facultatif — dire non ne se justifie pas.
-- Idempotent : réexécutable sans effet.

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "requestedAt"    TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "respondedAt"    TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "declineReason"  TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "completionNote" TEXT;

-- Les demandes DÉJÀ en base (statut REQUESTED / DECLINED) sont, par définition, nées d'une
-- demande : sans cette reprise, elles retomberaient dans le parcours des tâches ordinaires et
-- l'on reverrait « Démarrer » sur une demande acceptée.
UPDATE "Task"
   SET "requestedAt" = "createdAt"
 WHERE "requestedAt" IS NULL
   AND "status" IN ('REQUESTED', 'DECLINED');

CREATE INDEX IF NOT EXISTS "Task_requestedAt_idx" ON "Task" ("requestedAt");
