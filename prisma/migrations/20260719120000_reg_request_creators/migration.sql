-- Demandes à Regulatory : rôles autorisés à CRÉER (en plus du PRIM). Regulatory répond, ne crée pas.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "regRequestCreatorRoles" TEXT[] NOT NULL DEFAULT '{}'::text[];
