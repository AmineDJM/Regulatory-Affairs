-- LE REGISTRE UNIQUE DES LIENS D'AFFAIRE.
--
-- `MailEntryLink` ne savait relier qu'un courrier. Le flux réel d'une affaire en demande plus :
-- un contrat né d'un appel d'offres, un bon qui exécute ce contrat, une facture qui couvre un ou
-- plusieurs bons, une assurance rattachée à son contrat. Deux tables de liens auraient obligé
-- chaque fiche à interroger deux registres — et à en oublier un au troisième besoin.
--
-- Les lignes existantes sont RECOPIÉES : aucun lien déjà posé n'est perdu. L'ancienne table
-- n'est PAS supprimée (les données valent mieux qu'un schéma tiré au cordeau) ; elle n'est
-- simplement plus lue ni écrite par le code.
--
-- Idempotent de bout en bout.

CREATE TABLE IF NOT EXISTS "EntityLink" (
  "id"          TEXT NOT NULL,
  "fromType"    "EntityType" NOT NULL,
  "fromId"      TEXT NOT NULL,
  "fromLabel"   TEXT,
  "toType"      "EntityType" NOT NULL,
  "toId"        TEXT NOT NULL,
  "toLabel"     TEXT,
  "note"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntityLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntityLink_fromType_fromId_toType_toId_key"
  ON "EntityLink" ("fromType", "fromId", "toType", "toId");
CREATE INDEX IF NOT EXISTS "EntityLink_fromType_fromId_idx" ON "EntityLink" ("fromType", "fromId");
CREATE INDEX IF NOT EXISTS "EntityLink_toType_toId_idx" ON "EntityLink" ("toType", "toId");

-- REPRISE DES LIENS DE COURRIERS. La paire est rangée dans l'ordre CANONIQUE du flux
-- (voir `lib/links/graph.ts`) : le courrier a le rang le plus élevé, il est donc toujours le
-- SECOND membre de la paire. Le libellé photographié de la cible devient `fromLabel`, et celui
-- du courrier est relu depuis sa fiche.
INSERT INTO "EntityLink" ("id", "fromType", "fromId", "fromLabel", "toType", "toId", "toLabel", "createdById", "createdAt")
SELECT
  l."id",
  l."entityType",
  l."entityId",
  l."label",
  'MAIL_ENTRY'::"EntityType",
  l."entryId",
  COALESCE(NULLIF(CONCAT_WS(' — ', m."reference", m."title"), ''), m."title"),
  l."createdById",
  l."createdAt"
FROM "MailEntryLink" l
JOIN "MailEntry" m ON m."id" = l."entryId"
WHERE NOT EXISTS (
  SELECT 1 FROM "EntityLink" e
  WHERE e."fromType" = l."entityType" AND e."fromId" = l."entityId"
    AND e."toType" = 'MAIL_ENTRY'::"EntityType" AND e."toId" = l."entryId"
);
