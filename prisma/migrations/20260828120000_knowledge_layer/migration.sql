-- LA COUCHE DE CONNAISSANCE — quatre tables neuves (cf. schema.prisma).
--
-- Idempotente de bout en bout : IF NOT EXISTS partout. Elle n'écrit dans AUCUNE table existante
-- et ne touche à aucune donnée de production — elle ajoute, elle ne migre rien.
--
-- pgvector n'est PAS disponible sur cette infrastructure (vérifié : `vector` absent de
-- pg_available_extensions). Les vecteurs vivent donc en JSONB et le cosinus se fait en mémoire,
-- exactement comme pour le corpus CTD et l'index Drive. Le jour où l'extension existera, seule
-- la colonne `embedding` et la requête de rapprochement changeront — pas le pipeline.

-- ── L'échine ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "KnowledgeItem" (
  "id"              TEXT NOT NULL,
  "sourceType"      TEXT NOT NULL,
  "sourceId"        TEXT NOT NULL,
  "contentHash"     TEXT NOT NULL,

  "title"           TEXT,
  "docType"         TEXT,
  "language"        TEXT,
  "companyId"       TEXT,
  "confidentiality" TEXT,

  "text"            TEXT,
  "textFold"        TEXT,
  "meta"            JSONB,

  "extractedBy"     TEXT,
  "model"           TEXT,
  "confidence"      DOUBLE PRECISION,

  "documentDate"    TIMESTAMP(3),
  "effectiveDate"   TIMESTAMP(3),
  "validFrom"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validTo"         TIMESTAMP(3),
  "isCurrent"       BOOLEAN NOT NULL DEFAULT true,

  "version"         INTEGER NOT NULL DEFAULT 1,
  "supersedesId"    TEXT,

  "stage"           TEXT NOT NULL DEFAULT 'RECEIVED',
  "error"           TEXT,

  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- La CLÉ D'IDEMPOTENCE de toute la couche : réingérer la même source ne crée pas un second élément.
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeItem_sourceType_sourceId_key" ON "KnowledgeItem"("sourceType", "sourceId");
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeItem_supersedesId_key"       ON "KnowledgeItem"("supersedesId");
-- « Ai-je déjà ce contenu ? » — la question posée AVANT tout traitement.
CREATE INDEX IF NOT EXISTS "KnowledgeItem_contentHash_idx"  ON "KnowledgeItem"("contentHash");
-- « Qu'est-ce qui est bloqué ? » — l'observabilité §26 se lit sur cet index.
CREATE INDEX IF NOT EXISTS "KnowledgeItem_stage_idx"        ON "KnowledgeItem"("stage");
-- Le cloisonnement est la clause la plus fréquente de toute recherche : elle vient en tête.
CREATE INDEX IF NOT EXISTS "KnowledgeItem_company_current_idx" ON "KnowledgeItem"("companyId", "isCurrent");
CREATE INDEX IF NOT EXISTS "KnowledgeItem_docType_idx"      ON "KnowledgeItem"("docType");
CREATE INDEX IF NOT EXISTS "KnowledgeItem_documentDate_idx" ON "KnowledgeItem"("documentDate");
CREATE INDEX IF NOT EXISTS "KnowledgeItem_updatedAt_idx"    ON "KnowledgeItem"("updatedAt");

DO $$ BEGIN
  ALTER TABLE "KnowledgeItem"
    ADD CONSTRAINT "KnowledgeItem_supersedesId_fkey"
    FOREIGN KEY ("supersedesId") REFERENCES "KnowledgeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Les morceaux ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
  "id"        TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "ord"       INTEGER NOT NULL,
  "label"     TEXT,
  "locator"   TEXT,
  "text"      TEXT NOT NULL,
  "textFold"  TEXT NOT NULL,
  "embedding" JSONB,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- Rejouer l'extraction ne double pas les morceaux : l'ordre est unique DANS un élément.
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_itemId_ord_key" ON "KnowledgeChunk"("itemId", "ord");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_itemId_kind_idx"       ON "KnowledgeChunk"("itemId", "kind");

DO $$ BEGIN
  ALTER TABLE "KnowledgeChunk"
    ADD CONSTRAINT "KnowledgeChunk_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── La file ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "KnowledgeJob" (
  "id"          TEXT NOT NULL,
  "itemId"      TEXT,
  "kind"        TEXT NOT NULL,
  "priority"    INTEGER NOT NULL DEFAULT 50,
  "payload"     JSONB,
  "status"      TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 4,
  "runAfter"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt"   TIMESTAMP(3),
  "finishedAt"  TIMESTAMP(3),
  "lastError"   TEXT,
  "dedupeKey"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeJob_pkey" PRIMARY KEY ("id")
);

-- Deux jobs identiques ne coexistent pas : c'est ce qui rend la file rejouable sans doublon.
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeJob_dedupeKey_key" ON "KnowledgeJob"("dedupeKey");
-- L'index de PRISE DE TRAVAIL : statut, puis échéance, puis priorité — l'ordre exact du SELECT.
CREATE INDEX IF NOT EXISTS "KnowledgeJob_pick_idx"   ON "KnowledgeJob"("status", "runAfter", "priority");
CREATE INDEX IF NOT EXISTS "KnowledgeJob_item_idx"   ON "KnowledgeJob"("itemId", "kind");

DO $$ BEGIN
  ALTER TABLE "KnowledgeJob"
    ADD CONSTRAINT "KnowledgeJob_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Le graphe ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "KnowledgeLink" (
  "id"         TEXT NOT NULL,
  "itemId"     TEXT NOT NULL,
  "predicate"  TEXT NOT NULL,
  "toType"     TEXT NOT NULL,
  "toId"       TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "mention"    TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeLink_pkey" PRIMARY KEY ("id")
);

-- Un job rejoué ne double pas une arête.
CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeLink_edge_key"  ON "KnowledgeLink"("itemId", "predicate", "toType", "toId");
-- « Qu'est-ce qui parle de CE produit ? » — la question inverse, celle du graphe.
CREATE INDEX IF NOT EXISTS "KnowledgeLink_target_idx"       ON "KnowledgeLink"("toType", "toId");
CREATE INDEX IF NOT EXISTS "KnowledgeLink_predicate_idx"    ON "KnowledgeLink"("predicate");

DO $$ BEGIN
  ALTER TABLE "KnowledgeLink"
    ADD CONSTRAINT "KnowledgeLink_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Recherche plein texte (§11) ────────────────────────────────────────────────────────────
-- `pg_trgm` est installé sur cette base (vérifié) ; `unaccent` aussi. L'index trigramme sur la
-- colonne REPLIÉE est ce qui rend « reglement » capable de trouver « Règlement » sans dépendre
-- d'une configuration de dictionnaire. On indexe `textFold`, jamais `text` : indexer les deux
-- doublerait le coût d'écriture pour la même réponse.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_textFold_trgm" ON "KnowledgeChunk" USING GIN ("textFold" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "KnowledgeItem_textFold_trgm"  ON "KnowledgeItem"  USING GIN ("textFold" gin_trgm_ops);
