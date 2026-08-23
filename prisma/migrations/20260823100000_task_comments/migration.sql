-- LE FIL D'UNE TÂCHE — l'échange entre celui qui demande et celui qui fait.
--
-- Une demande se précise presque toujours (« pour quelle heure ? », « le bureau était fermé, je
-- repasse demain », « la facture est jointe »). Sans endroit pour l'écrire, cet échange partait en
-- messagerie et se séparait de la tâche qu'il concerne : trois semaines plus tard, la tâche dit
-- « validée » et personne ne retrouve pourquoi elle a pris dix jours.
--
-- `authorId` en SET NULL : désactiver un compte ne doit pas effacer ce qu'il a écrit — un fil
-- amputé de la moitié de ses messages ne s'explique plus.
CREATE TABLE IF NOT EXISTS "TaskComment" (
  "id"        TEXT         NOT NULL,
  "taskId"    TEXT         NOT NULL,
  "authorId"  TEXT,
  "body"      TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskComment_taskId_createdAt_idx" ON "TaskComment" ("taskId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "TaskComment"
    ADD CONSTRAINT "TaskComment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TaskComment"
    ADD CONSTRAINT "TaskComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
