-- Champ personnalisé « obligatoire » : le Super Admin décide qu'un champ doit être rempli.
-- Idempotent : rejouable sans effet si la colonne existe déjà.
ALTER TABLE "CustomFieldDef" ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT false;
