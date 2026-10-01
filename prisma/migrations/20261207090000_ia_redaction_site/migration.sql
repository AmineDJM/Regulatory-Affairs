-- « Rédiger avec l'IA » pour les articles et les offres du site public (§118.160).
-- Une bascule de plus au Centre de contrôle IA : le Super Admin coupe cette fonction sans couper
-- le reste. Activée par défaut, comme les autres — c'est un confort, l'autorisation reste au RBAC.
ALTER TABLE "AiSetting" ADD COLUMN IF NOT EXISTS "siteWebAiEnabled" BOOLEAN NOT NULL DEFAULT true;
