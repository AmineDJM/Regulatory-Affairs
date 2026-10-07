-- LA DIRECTION MARKETING ÉCRIT SES MESSAGES PAR DÉFAUT (Direction, 07/10 — Marketing cockpit).
--
-- Jusqu'ici la liste des auteurs (`promoMessageAuthorRoles`) valait VIDE par défaut : personne sauf le Super Admin
-- n'écrivait les messages que les rapports terrain exigent. Décision : la Direction Marketing (`PRODUCT_MANAGER`) les
-- écrit par défaut ; le Super Admin peut toujours changer la liste (Administration › Réglages).
--
-- Idempotent : le défaut de la colonne est reposé à l'identique, et seule une liste encore VIDE (l'ancien défaut,
-- jamais réglée) reçoit le rôle — une liste que le Super Admin a déjà posée n'est pas touchée.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "promoMessageAuthorRoles" TEXT[] NOT NULL DEFAULT ARRAY['PRODUCT_MANAGER']::TEXT[];
ALTER TABLE "AppSetting" ALTER COLUMN "promoMessageAuthorRoles" SET DEFAULT ARRAY['PRODUCT_MANAGER']::TEXT[];
UPDATE "AppSetting"
SET "promoMessageAuthorRoles" = ARRAY['PRODUCT_MANAGER']::TEXT[]
WHERE COALESCE(cardinality("promoMessageAuthorRoles"), 0) = 0;
