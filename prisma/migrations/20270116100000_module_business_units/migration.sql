-- LE MONTAGE DE LA FORCE DE VENTE DEVIENT UN MODULE A PART : « Business Units » (Direction, 08/10 : « tu crees dans le
-- menu un module "Business Units" et tu y mets BU et secteurs et parametres »). Ces ecrans etaient reserves a qui
-- CONFIGURAIT la Force de vente (SALES_PLANNING avec Modifier, ou la vue globale). Le module BUSINESS_UNITS recoit par
-- defaut, role par role, les gestes de SALES_PLANNING des seuls roles qui la modifiaient (lisible dans la console) ; les
-- ACCES PERSONNALISES deja poses sur SALES_PLANNING sont recopies :
--   - un acces qui pouvait MODIFIER la Force de vente est recopie tel quel (memes cases, meme portee) ;
--   - tout autre acces personnalise (lecture seule, ou bloque) devient un BLOCAGE du nouveau module : il retirait la
--     configuration a la personne, il la lui retire encore — sans quoi le defaut de son role la lui rendrait.
-- Personne ne perd le montage, personne ne le gagne. Idempotent : un acces deja pose sur le module n'est jamais reecrit.
INSERT INTO "UserAccess" ("id", "userId", "module", "canView", "canCreate", "canUpdate", "canDelete", "canValidate", "canExport", "canUpload", "scope", "sections", "createdAt", "updatedAt")
SELECT 'bu_' || substr(md5(ua."id" || 'BUSINESS_UNITS'), 1, 22), ua."userId", 'BUSINESS_UNITS',
       (ua."canView" AND ua."canUpdate"),
       (ua."canView" AND ua."canUpdate" AND ua."canCreate"),
       (ua."canView" AND ua."canUpdate"),
       (ua."canView" AND ua."canUpdate" AND ua."canDelete"),
       (ua."canView" AND ua."canUpdate" AND ua."canValidate"),
       (ua."canView" AND ua."canUpdate" AND ua."canExport"),
       (ua."canView" AND ua."canUpdate" AND ua."canUpload"),
       ua."scope", '{}'::text[], NOW(), NOW()
FROM "UserAccess" ua
WHERE ua."module" = 'SALES_PLANNING'
ON CONFLICT ("userId", "module") DO NOTHING;