-- LE RÉFÉRENTIEL D'ENTITÉS — deux tables neuves (cf. schema.prisma).
--
-- Idempotente de bout en bout. Elle n'écrit dans AUCUNE table existante et ne touche à aucune
-- donnée de production : elle ajoute deux tables vides, que la projection remplira ensuite en
-- LISANT les fiches ERP (produits, sociétés, fournisseurs, personnes).

CREATE TABLE IF NOT EXISTS "KnowledgeEntity" (
  "id"            TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  -- Clé d'identité déterministe. Une contrainte sur (kind, refType, refId) n'aurait pas
  -- dédoublonné : Postgres tient deux NULL pour distincts, donc toute entité sans fiche ERP se
  -- serait recréée à chaque passage de la projection.
  "key"           TEXT NOT NULL,
  "refType"       TEXT,
  "refId"         TEXT,
  "canonicalName" TEXT NOT NULL,
  "nameFold"      TEXT NOT NULL,
  "companyId"     TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeEntity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeEntity_key_key" ON "KnowledgeEntity"("key");
CREATE INDEX IF NOT EXISTS "KnowledgeEntity_kind_nameFold_idx" ON "KnowledgeEntity"("kind", "nameFold");
CREATE INDEX IF NOT EXISTS "KnowledgeEntity_refType_refId_idx" ON "KnowledgeEntity"("refType", "refId");
CREATE INDEX IF NOT EXISTS "KnowledgeEntity_companyId_idx" ON "KnowledgeEntity"("companyId");

CREATE TABLE IF NOT EXISTS "KnowledgeAlias" (
  "id"        TEXT NOT NULL,
  "entityId"  TEXT NOT NULL,
  "alias"     TEXT NOT NULL,
  "aliasFold" TEXT NOT NULL,
  "source"    TEXT NOT NULL,
  "weight"    DOUBLE PRECISION NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeAlias_entityId_aliasFold_key" ON "KnowledgeAlias"("entityId", "aliasFold");
CREATE INDEX IF NOT EXISTS "KnowledgeAlias_aliasFold_idx" ON "KnowledgeAlias"("aliasFold");

DO $$ BEGIN
  ALTER TABLE "KnowledgeAlias"
    ADD CONSTRAINT "KnowledgeAlias_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "KnowledgeEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- L'INDEX TRIGRAMME sur les alias. C'est lui qui rend la tolérance aux fautes de frappe
-- praticable : sans lui, rapprocher « Kwlaity » de « Kwality » demanderait de rapatrier tous les
-- alias en mémoire à chaque question. `pg_trgm` est déjà installé par la migration précédente ;
-- le CREATE EXTENSION est répété parce qu'une migration doit tenir seule.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "KnowledgeAlias_aliasFold_trgm" ON "KnowledgeAlias" USING GIN ("aliasFold" gin_trgm_ops);
