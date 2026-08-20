-- LE PARTENAIRE D'UN COURRIER — la liste que tient l'assistante de direction.
--
-- Liste PROPRE au registre, et non les fournisseurs du Regulatory : ceux-là sont des fabricants
-- pharmaceutiques référencés dans des dossiers d'enregistrement. Les mêler ferait de
-- l'assistante quelqu'un qui peut supprimer un fabricant d'AMM en rangeant son courrier.
--
-- Le rattachement est FACULTATIF : beaucoup de plis sont internes ou n'engagent personne
-- d'extérieur, et rendre le champ obligatoire ferait inventer des partenaires pour pouvoir
-- enregistrer un courrier.
-- Idempotent : rejouable sur une instance déjà migrée.

CREATE TABLE IF NOT EXISTS "MailPartner" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "kind"        TEXT,
  "contact"     TEXT,
  "notes"       TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailPartner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MailPartner_name_key" ON "MailPartner"("name");
CREATE INDEX IF NOT EXISTS "MailPartner_isActive_idx" ON "MailPartner"("isActive");

ALTER TABLE "MailEntry" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
CREATE INDEX IF NOT EXISTS "MailEntry_partnerId_idx" ON "MailEntry"("partnerId");

DO $$ BEGIN
  ALTER TABLE "MailEntry" ADD CONSTRAINT "MailEntry_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "MailPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
