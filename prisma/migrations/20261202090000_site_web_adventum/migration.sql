-- LE SITE WEB ADVENTUM (§118.158) : les offres d'emploi et les articles que l'ERP POUSSE vers le
-- site public, la file d'envoi (une ligne par contenu), le journal des requêtes, les rapports de
-- réconciliation, et le disjoncteur posé quand le site refuse la configuration.
--
-- Idempotent : `IF NOT EXISTS` partout, types et contraintes posés par bloc conditionnel. Aucune
-- donnée n'est semée : rien n'est publié tant qu'une personne ne l'a pas décidé.
-- Le circuit documenté est `db:deploy` (jamais `psql` à la main — §118.110).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteContentKind') THEN
    CREATE TYPE "SiteContentKind" AS ENUM ('JOB', 'POST');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteSyncState') THEN
    CREATE TYPE "SiteSyncState" AS ENUM ('PENDING', 'DONE', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "JobPosting" (
    "id"                   TEXT NOT NULL,
    "recruitmentRequestId" TEXT,
    "title"                TEXT NOT NULL,
    "department"           TEXT,
    "location"             TEXT,
    "contractLabel"        TEXT,
    "experience"           TEXT,
    "summary"              TEXT,
    "mission"              TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profile"              TEXT[] DEFAULT ARRAY[]::TEXT[],
    "offer"                TEXT[] DEFAULT ARRAY[]::TEXT[],
    "published"            BOOLEAN NOT NULL DEFAULT false,
    "createdById"          TEXT,
    "updatedById"          TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BlogArticle" (
    "id"               TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "slug"             TEXT,
    "description"      TEXT,
    "body"             TEXT NOT NULL,
    "category"         TEXT,
    "tags"             TEXT[] DEFAULT ARRAY[]::TEXT[],
    "author"           TEXT,
    "publishedOn"      TIMESTAMP(3),
    "firstPublishedAt" TIMESTAMP(3),
    "revisedAt"        TIMESTAMP(3),
    "featured"         BOOLEAN NOT NULL DEFAULT false,
    "published"        BOOLEAN NOT NULL DEFAULT false,
    "createdById"      TEXT,
    "updatedById"      TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlogArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SitePublication" (
    "id"                 TEXT NOT NULL,
    "kind"               "SiteContentKind" NOT NULL,
    "externalId"         TEXT NOT NULL,
    "label"              TEXT NOT NULL,
    "operation"          TEXT NOT NULL,
    "body"               TEXT,
    "bodyHash"           TEXT,
    "version"            INTEGER NOT NULL DEFAULT 1,
    "state"              "SiteSyncState" NOT NULL DEFAULT 'PENDING',
    "attempts"           INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt"          TIMESTAMP(3),
    "lastStatus"         INTEGER,
    "lastError"          TEXT,
    "lastAttemptAt"      TIMESTAMP(3),
    "confirmedHash"      TEXT,
    "confirmedPublished" BOOLEAN,
    "confirmedAt"        TIMESTAMP(3),
    "siteUrl"            TEXT,
    "siteSlug"           TEXT,
    "requestedById"      TEXT,
    "alertedAt"          TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SitePushAttempt" (
    "id"            TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "kind"          "SiteContentKind" NOT NULL,
    "externalId"    TEXT NOT NULL,
    "method"        TEXT NOT NULL,
    "path"          TEXT NOT NULL,
    "version"       INTEGER NOT NULL,
    "status"        INTEGER,
    "outcome"       TEXT NOT NULL,
    "responseBody"  TEXT,
    "error"         TEXT,
    "durationMs"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SitePushAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SiteReconciliation" (
    "id"           TEXT NOT NULL,
    "trigger"      TEXT NOT NULL,
    "byId"         TEXT,
    "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"   TIMESTAMP(3),
    "ok"           BOOLEAN NOT NULL DEFAULT false,
    "error"        TEXT,
    "siteJobs"     INTEGER,
    "sitePosts"    INTEGER,
    "conformes"    INTEGER NOT NULL DEFAULT 0,
    "repousses"    INTEGER NOT NULL DEFAULT 0,
    "suppressions" INTEGER NOT NULL DEFAULT 0,
    "rejetes"      INTEGER NOT NULL DEFAULT 0,
    "orphelins"    JSONB,
    "collisions"   JSONB,
    "ecarts"       JSONB,
    "manuels"      JSONB,
    "depotSlugs"   TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "SiteReconciliation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "siteBlocageEmpreinte" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "siteBlocageAt" TIMESTAMP(3);
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "siteBlocageMotif" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "JobPosting_recruitmentRequestId_key" ON "JobPosting"("recruitmentRequestId");
CREATE INDEX IF NOT EXISTS "JobPosting_published_idx" ON "JobPosting"("published");
CREATE UNIQUE INDEX IF NOT EXISTS "BlogArticle_slug_key" ON "BlogArticle"("slug");
CREATE INDEX IF NOT EXISTS "BlogArticle_published_idx" ON "BlogArticle"("published");
CREATE UNIQUE INDEX IF NOT EXISTS "SitePublication_kind_externalId_key" ON "SitePublication"("kind", "externalId");
CREATE INDEX IF NOT EXISTS "SitePublication_state_nextAttemptAt_idx" ON "SitePublication"("state", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "SitePushAttempt_publicationId_createdAt_idx" ON "SitePushAttempt"("publicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "SitePushAttempt_createdAt_idx" ON "SitePushAttempt"("createdAt");
CREATE INDEX IF NOT EXISTS "SiteReconciliation_startedAt_idx" ON "SiteReconciliation"("startedAt");

DO $$
BEGIN
  -- Une offre SURVIT à la suppression de sa demande de recrutement : elle peut être en ligne, et
  -- c'est à une personne de décider de la retirer.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobPosting_recruitmentRequestId_fkey') THEN
    ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_recruitmentRequestId_fkey"
      FOREIGN KEY ("recruitmentRequestId") REFERENCES "RecruitmentRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobPosting_createdById_fkey') THEN
    ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobPosting_updatedById_fkey') THEN
    ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlogArticle_createdById_fkey') THEN
    ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BlogArticle_updatedById_fkey') THEN
    ALTER TABLE "BlogArticle" ADD CONSTRAINT "BlogArticle_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SitePushAttempt_publicationId_fkey') THEN
    ALTER TABLE "SitePushAttempt" ADD CONSTRAINT "SitePushAttempt_publicationId_fkey"
      FOREIGN KEY ("publicationId") REFERENCES "SitePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
