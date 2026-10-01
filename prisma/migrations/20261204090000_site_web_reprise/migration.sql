-- LA REPRISE DES CONTENUS DU SITE (§118.160) : les articles du dépôt du site, ses offres d'exemple et
-- les offres saisies dans son administration deviennent des enregistrements de l'ERP, que l'on modifie
-- et supprime depuis le module « Site web ».
--
-- Idempotent : `IF NOT EXISTS` partout, contraintes posées par bloc conditionnel. Rien n'est semé ici :
-- la reprise a lieu au premier rapprochement qui sait lire le dépôt du site — c'est le rapprochement
-- qui LIT ce que le site détient, jamais une migration qui le devinerait.
-- Le circuit documenté est `db:deploy` (jamais `psql` à la main — §118.110).

CREATE TABLE IF NOT EXISTS "SiteReprise" (
    "id"        TEXT NOT NULL,
    "origine"   TEXT NOT NULL,
    "cleSite"   TEXT NOT NULL,
    "titre"     TEXT NOT NULL,
    "articleId" TEXT,
    "jobId"     TEXT,
    "parId"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteReprise_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SiteReprise_articleId_key" ON "SiteReprise"("articleId");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteReprise_jobId_key" ON "SiteReprise"("jobId");
-- UNE reprise par contenu du site, tenu par la base : deux rapprochements qui se croisent ne créent
-- pas deux copies du même article — le second perd sur cette contrainte, et c'est voulu.
CREATE UNIQUE INDEX IF NOT EXISTS "SiteReprise_origine_cleSite_key" ON "SiteReprise"("origine", "cleSite");

DO $$
BEGIN
  -- La reprise SURVIT au contenu : un article repris puis supprimé reste caché sur le site.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteReprise_articleId_fkey') THEN
    ALTER TABLE "SiteReprise" ADD CONSTRAINT "SiteReprise_articleId_fkey"
      FOREIGN KEY ("articleId") REFERENCES "BlogArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteReprise_jobId_fkey') THEN
    ALTER TABLE "SiteReprise" ADD CONSTRAINT "SiteReprise_jobId_fkey"
      FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "SiteReconciliation" ADD COLUMN IF NOT EXISTS "repriseLue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteReconciliation" ADD COLUMN IF NOT EXISTS "repris" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SiteReconciliation" ADD COLUMN IF NOT EXISTS "reprise" JSONB;
