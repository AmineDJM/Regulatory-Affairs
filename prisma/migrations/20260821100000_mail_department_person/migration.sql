-- COURRIERS : la direction et/ou la personne concernée par le pli.
--
-- Un courrier arrive au registre, mais il s'adresse à quelqu'un. Sans ces colonnes, l'assistante
-- doit se souvenir de qui l'attendait, et un pli non relevé ne se retrouve que par son objet.
-- Les deux se cumulent : un contrat vise « la Direction Générale » ET son directeur ; une
-- convocation ne vise qu'une personne.
--
-- SET NULL et non CASCADE : la suppression d'un département ou d'un compte ne doit jamais
-- effacer une ligne du registre — le chrono du courrier est une trace, pas une donnée dérivée.
--
-- Idempotent : réexécutable sans effet.

ALTER TABLE "MailEntry" ADD COLUMN IF NOT EXISTS "departmentId"    TEXT;
ALTER TABLE "MailEntry" ADD COLUMN IF NOT EXISTS "concernedUserId" TEXT;

CREATE INDEX IF NOT EXISTS "MailEntry_departmentId_idx"    ON "MailEntry" ("departmentId");
CREATE INDEX IF NOT EXISTS "MailEntry_concernedUserId_idx" ON "MailEntry" ("concernedUserId");

DO $$ BEGIN
  ALTER TABLE "MailEntry" ADD CONSTRAINT "MailEntry_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MailEntry" ADD CONSTRAINT "MailEntry_concernedUserId_fkey"
    FOREIGN KEY ("concernedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
