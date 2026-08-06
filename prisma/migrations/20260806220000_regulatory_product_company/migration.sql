-- Chaque produit du Regulatory appartient à une entité.
--
-- L'entité détermine QUI a le droit de voir le dossier. Un produit sans entité apparaît dans la
-- vue « toutes les entités » de tout le monde : la laisser facultative revenait à publier le
-- dossier au groupe entier par défaut.
--
-- REPRISE PRUDENTE : on ne rattache que ce qui est SANS AMBIGUÏTÉ, c'est-à-dire quand le groupe
-- ne compte qu'une seule entité active. Avec plusieurs entités, deviner l'appartenance d'un
-- dossier réglementaire serait pire que de la laisser vide : un dossier attribué à la mauvaise
-- société est plus difficile à repérer qu'un dossier visiblement non attribué. Ceux qui restent
-- sont signalés à l'écran pour être rattachés à la main.
--
-- La colonne reste donc NULLABLE en base : la contrainte est tenue par l'application (création
-- et modification refusent une entité vide). Une migration ultérieure pourra poser le NOT NULL
-- une fois le stock assaini.

UPDATE "RegulatoryProduct" p
SET "companyId" = (SELECT c."id" FROM "Company" c WHERE c."isActive" = true)
WHERE p."companyId" IS NULL
  AND (SELECT COUNT(*) FROM "Company" WHERE "isActive" = true) = 1;
