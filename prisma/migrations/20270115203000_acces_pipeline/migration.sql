-- LE PIPELINE REGLEMENTAIRE DEVIENT UN MODULE A PART (Direction, 08/10 : « sépare Pipeline et Suivi de dossiers dans
-- les accès … pour que je contrôle »). Le module REGULATORY_PIPELINE reçoit par défaut, rôle par rôle, exactement les
-- gestes de REGULATORY (lisible dans la console) ; les ACCÈS PERSONNALISÉS déjà posés sur REGULATORY sont recopiés tels
-- quels sur le pipeline — y compris les BLOCAGES (canView = false) : personne ne perd le pipeline, personne ne le gagne.
-- Idempotent : un accès déjà posé sur le pipeline n'est jamais réécrit.
INSERT INTO "UserAccess" ("id", "userId", "module", "canView", "canCreate", "canUpdate", "canDelete", "canValidate", "canExport", "canUpload", "scope", "sections", "createdAt", "updatedAt")
SELECT 'pl_' || substr(md5(ua."id" || 'REGULATORY_PIPELINE'), 1, 22), ua."userId", 'REGULATORY_PIPELINE', ua."canView", ua."canCreate", ua."canUpdate", ua."canDelete",
       ua."canValidate", ua."canExport", ua."canUpload", ua."scope", '{}'::text[], NOW(), NOW()
FROM "UserAccess" ua
WHERE ua."module" = 'REGULATORY'
ON CONFLICT ("userId", "module") DO NOTHING;
