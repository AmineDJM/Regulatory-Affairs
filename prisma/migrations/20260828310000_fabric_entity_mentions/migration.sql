-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- INFORMATION FABRIC — F4 : les MENTIONS d'entités deviennent un lien PERSISTÉ.
--
-- ── LE COÛT QUE CETTE TABLE SUPPRIME ─────────────────────────────────────────────────────
--
-- « Tout ce qui concerne le Pembrolizumab » se payait à CHAQUE question : une recherche texte
-- sur tout le corpus, qui en plus ne franchit pas les ALIAS — un document qui ne dit que
-- « Keytruda » n'apparaît jamais quand on cherche la DCI. L'entité canonique (RegulatoryProduct
-- porte les deux noms) existait ; le LIEN document ↔ entité n'était persisté nulle part.
--
-- L'extraction est DÉTERMINISTE (dictionnaire des canoniques, frontières de mots), faite À
-- L'INGESTION — le travail se paie une fois quand l'information entre, plus jamais à la
-- question (§3 du mandat : ne plus scanner à la demande).
--
-- `mentionsAt` sur DriveTextIndex : l'estampille d'extraction. NULL = jamais extrait — c'est ce
-- que le balayage de rattrapage consulte, et c'est une date, pas un booléen : ré-extraire après
-- un changement de dictionnaire se décide en comparant des instants, pas en devinant.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "EntityMention" (
  "id"          TEXT NOT NULL,
  "nodeId"      TEXT NOT NULL,
  "entityType"  TEXT NOT NULL,
  "entityId"    TEXT NOT NULL,
  "entityLabel" TEXT NOT NULL,
  "occurrences" INTEGER NOT NULL DEFAULT 1,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntityMention_pkey" PRIMARY KEY ("id")
);

-- Un document mentionne une entité UNE fois (avec son compte) — l'upsert s'appuie dessus.
CREATE UNIQUE INDEX IF NOT EXISTS "EntityMention_nodeId_entityType_entityId_key"
  ON "EntityMention" ("nodeId", "entityType", "entityId");
-- LA question de la fabric : « tous les documents liés à CETTE entité » — servie par index.
CREATE INDEX IF NOT EXISTS "EntityMention_entityType_entityId_idx"
  ON "EntityMention" ("entityType", "entityId");

DO $$
BEGIN
  ALTER TABLE "EntityMention"
    ADD CONSTRAINT "EntityMention_nodeId_fkey" FOREIGN KEY ("nodeId")
    REFERENCES "DriveNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "DriveTextIndex" ADD COLUMN IF NOT EXISTS "mentionsAt" TIMESTAMP(3);
