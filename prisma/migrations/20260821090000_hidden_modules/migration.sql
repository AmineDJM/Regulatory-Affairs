-- MODULES MASQUÉS — retirer un module de la plateforme sans toucher aux droits ni aux données.
--
-- Ce n'est pas une permission (« cette personne n'y a pas droit ») mais un état de service
-- (« ce module n'est pas en usage ici »). Rien n'est supprimé : démasquer rend le module tel
-- qu'il était.
--
-- Idempotent : réexécutable sans effet.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "hiddenModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
