-- CORPUS : « importé = utilisé ». L'ancien circuit créait chaque version en DRAFT et exigeait
-- une activation séparée ; en production, des dizaines de textes déposés restaient « sans effet »
-- sans que rien ne le rende actionnable. Désormais l'import par l'administrateur VAUT activation
-- (changement de code), et cette migration RATTRAPE l'existant :
--   • la DERNIÈRE version de chaque texte encore en DRAFT devient ACTIVE ;
--   • une seule version ACTIVE par texte — les plus anciennes passent RETIRED ;
--   • les PAGES DE VEILLE (codes *-INDEX : sommaires de site, pas des textes) restent en relevé.
-- Idempotent — sûr à rejouer.

WITH latest AS (
  SELECT DISTINCT ON (v."sourceId") v.id
  FROM "RegulatorySourceVersion" v
  JOIN "RegulatorySource" s ON s.id = v."sourceId"
  WHERE s.code NOT LIKE '%-INDEX'
  ORDER BY v."sourceId", v."createdAt" DESC
)
UPDATE "RegulatorySourceVersion" v
SET status = 'ACTIVE'::"RegSourceStatus", "approvedAt" = NOW()
FROM latest l
WHERE v.id = l.id AND v.status = 'DRAFT'::"RegSourceStatus";

WITH keep AS (
  SELECT DISTINCT ON ("sourceId") id, "sourceId"
  FROM "RegulatorySourceVersion"
  WHERE status = 'ACTIVE'::"RegSourceStatus"
  ORDER BY "sourceId", "createdAt" DESC
)
UPDATE "RegulatorySourceVersion" v
SET status = 'RETIRED'::"RegSourceStatus"
WHERE v.status = 'ACTIVE'::"RegSourceStatus"
  AND EXISTS (SELECT 1 FROM keep k WHERE k."sourceId" = v."sourceId" AND k.id <> v.id);
