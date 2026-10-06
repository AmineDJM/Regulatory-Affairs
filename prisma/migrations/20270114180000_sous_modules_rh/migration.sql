-- LES SOUS-MODULES RH (Direction, 06/10) : « Employés » (EMPLOYEES), « Demandes RH » (HR_REQUESTS) et « Formations »
-- (TRAINING) deviennent des modules à part. Les rôles les reçoivent par défaut de leur droit « RH » (lisible dans la
-- console) ; les ACCÈS PERSONNALISÉS déjà accordés sur « RH » sont recopiés tels quels sur les trois sous-modules, pour
-- que personne ne perde ce qu'il avait. Idempotent : un accès déjà posé sur un sous-module n'est jamais réécrit.
INSERT INTO "UserAccess" ("id", "userId", "module", "canView", "canCreate", "canUpdate", "canDelete", "canValidate", "canExport", "canUpload", "scope", "sections", "createdAt", "updatedAt")
SELECT 'sm_' || substr(md5(ua."id" || m.module), 1, 22), ua."userId", m.module, ua."canView", ua."canCreate", ua."canUpdate", ua."canDelete",
       ua."canValidate", ua."canExport", ua."canUpload", ua."scope", '{}'::text[], NOW(), NOW()
FROM "UserAccess" ua
CROSS JOIN (VALUES ('EMPLOYEES'), ('HR_REQUESTS'), ('TRAINING')) AS m(module)
WHERE ua."module" = 'RH'
ON CONFLICT ("userId", "module") DO NOTHING;
