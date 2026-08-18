-- LES GAMMES — entité → gammes → produits, et le rattachement des personnes.
--
-- L'entité dit DE QUI est un produit ; la gamme dit DE QUOI il relève (« Cardiologie »,
-- « Hôpital »…). Les deux ensemble forment l'arbre qu'on lit en Administration, et c'est de
-- cet arbre que découle ce que chacun voit : rattaché à une ENTITÉ, on voit toute la société ;
-- rattaché à une ou plusieurs GAMMES, on ne voit que leurs produits.
--
-- Rien n'est deviné et rien n'est détruit : aucune gamme n'est créée automatiquement, aucun
-- produit n'est classé d'office, et supprimer une gamme laisse ses produits en place (sans
-- gamme) plutôt que de les emporter.
-- Idempotent : rejouable sur une instance déjà migrée.

CREATE TABLE IF NOT EXISTS "ProductRange" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "companyId"   TEXT NOT NULL,
  "description" TEXT,
  "color"       TEXT,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductRange_pkey" PRIMARY KEY ("id")
);

-- Deux gammes du même nom dans la même entité n'auraient aucun sens : on ne saurait pas
-- laquelle on rattache. Le même nom dans DEUX entités, en revanche, est normal.
CREATE UNIQUE INDEX IF NOT EXISTS "ProductRange_companyId_name_key" ON "ProductRange"("companyId", "name");
CREATE INDEX IF NOT EXISTS "ProductRange_companyId_idx" ON "ProductRange"("companyId");

DO $$ BEGIN
  ALTER TABLE "ProductRange" ADD CONSTRAINT "ProductRange_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Le produit porte SA gamme, facultative : beaucoup de dossiers n'en relèvent d'aucune, et
-- l'imposer aurait obligé à inventer une gamme pour chaque produit importé.
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "rangeId" TEXT;
CREATE INDEX IF NOT EXISTS "RegulatoryProduct_rangeId_idx" ON "RegulatoryProduct"("rangeId");

DO $$ BEGIN
  ALTER TABLE "RegulatoryProduct" ADD CONSTRAINT "RegulatoryProduct_rangeId_fkey"
    FOREIGN KEY ("rangeId") REFERENCES "ProductRange"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Le rattachement d'une personne à une gamme. Plusieurs lignes par personne : plusieurs
-- gammes, de la même entité ou de sociétés différentes.
CREATE TABLE IF NOT EXISTS "UserProductRange" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "rangeId"     TEXT NOT NULL,
  "grantedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserProductRange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserProductRange_userId_rangeId_key" ON "UserProductRange"("userId", "rangeId");
CREATE INDEX IF NOT EXISTS "UserProductRange_userId_idx" ON "UserProductRange"("userId");
CREATE INDEX IF NOT EXISTS "UserProductRange_rangeId_idx" ON "UserProductRange"("rangeId");

DO $$ BEGIN
  ALTER TABLE "UserProductRange" ADD CONSTRAINT "UserProductRange_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "UserProductRange" ADD CONSTRAINT "UserProductRange_rangeId_fkey"
    FOREIGN KEY ("rangeId") REFERENCES "ProductRange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
