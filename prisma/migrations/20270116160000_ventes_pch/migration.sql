-- VENTES PCH (Operations & Sales) : les fichiers de la PCH importes (ventes des directions regionales aux hopitaux,
-- receptions de la PCH centrale), leurs lignes, la memoire des rattachements (postes PCH -> nos produits, clients ->
-- etablissements), les directions regionales et nos fournisseurs PCH par produit. Plus le marquage d'un BC d'avenant.
-- Idempotent : chaque objet n'est cree que s'il manque.

CREATE TABLE IF NOT EXISTS "PchVenteImport" (
  "id" TEXT NOT NULL,
  "nature" TEXT NOT NULL,
  "nomFichier" TEXT NOT NULL,
  "empreinte" TEXT NOT NULL,
  "taille" INTEGER NOT NULL,
  "fichier" BYTEA NOT NULL,
  "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "mois" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "annuel" BOOLEAN NOT NULL DEFAULT false,
  "lignes" INTEGER NOT NULL DEFAULT 0,
  "rapport" JSONB,
  "remplaceParId" TEXT,
  "remplaceLe" TIMESTAMP(3),
  "auteurId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchVenteImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PchVenteImport_empreinte_key" ON "PchVenteImport"("empreinte");
CREATE INDEX IF NOT EXISTS "PchVenteImport_nature_createdAt_idx" ON "PchVenteImport"("nature", "createdAt");

CREATE TABLE IF NOT EXISTS "PchVenteLigne" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "ligneSource" INTEGER NOT NULL,
  "dr" TEXT NOT NULL,
  "mois" DATE NOT NULL,
  "famille" TEXT,
  "classe" TEXT,
  "client" TEXT NOT NULL,
  "clientCle" TEXT NOT NULL,
  "institutionId" TEXT,
  "poste" INTEGER,
  "dci" TEXT NOT NULL,
  "molecule" TEXT,
  "cle" TEXT,
  "productId" TEXT,
  "uc" TEXT,
  "lot" TEXT,
  "ddp" TEXT,
  "qteCommandee" INTEGER NOT NULL DEFAULT 0,
  "qteLivree" INTEGER NOT NULL DEFAULT 0,
  "coutAchat" DECIMAL(14,2),
  "prixVente" DECIMAL(14,2),
  "valeurAchat" DECIMAL(16,2),
  "dateFacture" DATE,
  "statut" TEXT NOT NULL,
  CONSTRAINT "PchVenteLigne_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PchVenteLigne_importId_idx" ON "PchVenteLigne"("importId");
CREATE INDEX IF NOT EXISTS "PchVenteLigne_dr_mois_idx" ON "PchVenteLigne"("dr", "mois");
CREATE INDEX IF NOT EXISTS "PchVenteLigne_mois_idx" ON "PchVenteLigne"("mois");
CREATE INDEX IF NOT EXISTS "PchVenteLigne_productId_mois_idx" ON "PchVenteLigne"("productId", "mois");
CREATE INDEX IF NOT EXISTS "PchVenteLigne_molecule_mois_idx" ON "PchVenteLigne"("molecule", "mois");
CREATE INDEX IF NOT EXISTS "PchVenteLigne_institutionId_mois_idx" ON "PchVenteLigne"("institutionId", "mois");
CREATE INDEX IF NOT EXISTS "PchVenteLigne_clientCle_idx" ON "PchVenteLigne"("clientCle");
CREATE INDEX IF NOT EXISTS "PchVenteLigne_poste_idx" ON "PchVenteLigne"("poste");

CREATE TABLE IF NOT EXISTS "PchReceptionLigne" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "ligneSource" INTEGER NOT NULL,
  "mois" DATE NOT NULL,
  "dateStockage" DATE,
  "gamme" TEXT,
  "classe" TEXT,
  "codeFour" INTEGER,
  "fournisseur" TEXT NOT NULL,
  "fournisseurCle" TEXT NOT NULL,
  "numBr" TEXT,
  "codePro" INTEGER,
  "designation" TEXT NOT NULL,
  "molecule" TEXT,
  "cle" TEXT,
  "productId" TEXT,
  "conditionnement" TEXT,
  "qte" INTEGER NOT NULL DEFAULT 0,
  "coutUnit" DECIMAL(16,2),
  "devise" TEXT,
  "type" TEXT NOT NULL,
  "avoirNo" TEXT,
  CONSTRAINT "PchReceptionLigne_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PchReceptionLigne_importId_idx" ON "PchReceptionLigne"("importId");
CREATE INDEX IF NOT EXISTS "PchReceptionLigne_mois_idx" ON "PchReceptionLigne"("mois");
CREATE INDEX IF NOT EXISTS "PchReceptionLigne_productId_mois_idx" ON "PchReceptionLigne"("productId", "mois");
CREATE INDEX IF NOT EXISTS "PchReceptionLigne_molecule_mois_idx" ON "PchReceptionLigne"("molecule", "mois");
CREATE INDEX IF NOT EXISTS "PchReceptionLigne_codePro_idx" ON "PchReceptionLigne"("codePro");
CREATE INDEX IF NOT EXISTS "PchReceptionLigne_fournisseurCle_idx" ON "PchReceptionLigne"("fournisseurCle");

CREATE TABLE IF NOT EXISTS "PchPoste" (
  "poste" INTEGER NOT NULL,
  "designation" TEXT NOT NULL,
  "molecule" TEXT,
  "cle" TEXT,
  "productId" TEXT,
  "manuel" BOOLEAN NOT NULL DEFAULT false,
  "statut" TEXT NOT NULL DEFAULT 'MARCHE',
  "confirmeParId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchPoste_pkey" PRIMARY KEY ("poste")
);
CREATE INDEX IF NOT EXISTS "PchPoste_productId_idx" ON "PchPoste"("productId");
CREATE INDEX IF NOT EXISTS "PchPoste_molecule_idx" ON "PchPoste"("molecule");

CREATE TABLE IF NOT EXISTS "PchEtablissementMemoire" (
  "cle" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "confirmeParId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchEtablissementMemoire_pkey" PRIMARY KEY ("cle")
);
CREATE INDEX IF NOT EXISTS "PchEtablissementMemoire_institutionId_idx" ON "PchEtablissementMemoire"("institutionId");

CREATE TABLE IF NOT EXISTS "PchDirectionRegionale" (
  "code" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "wilayas" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchDirectionRegionale_pkey" PRIMARY KEY ("code")
);

CREATE TABLE IF NOT EXISTS "PchFournisseurProduit" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "fournisseurCle" TEXT NOT NULL,
  "libelle" TEXT NOT NULL,
  "origine" TEXT NOT NULL DEFAULT 'AUTO',
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PchFournisseurProduit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PchFournisseurProduit_productId_fournisseurCle_key" ON "PchFournisseurProduit"("productId", "fournisseurCle");
CREATE INDEX IF NOT EXISTS "PchFournisseurProduit_fournisseurCle_idx" ON "PchFournisseurProduit"("fournisseurCle");

-- Le BC d'avenant (commande au-dela du volume attribue par l'AO).
ALTER TABLE "PchOrder" ADD COLUMN IF NOT EXISTS "estAvenant" BOOLEAN NOT NULL DEFAULT false;

-- Cles etrangeres, posees une seule fois.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchVenteLigne_importId_fkey') THEN
    ALTER TABLE "PchVenteLigne" ADD CONSTRAINT "PchVenteLigne_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PchVenteImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchVenteLigne_institutionId_fkey') THEN
    ALTER TABLE "PchVenteLigne" ADD CONSTRAINT "PchVenteLigne_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchVenteLigne_productId_fkey') THEN
    ALTER TABLE "PchVenteLigne" ADD CONSTRAINT "PchVenteLigne_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchReceptionLigne_importId_fkey') THEN
    ALTER TABLE "PchReceptionLigne" ADD CONSTRAINT "PchReceptionLigne_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PchVenteImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchReceptionLigne_productId_fkey') THEN
    ALTER TABLE "PchReceptionLigne" ADD CONSTRAINT "PchReceptionLigne_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchPoste_productId_fkey') THEN
    ALTER TABLE "PchPoste" ADD CONSTRAINT "PchPoste_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PchFournisseurProduit_productId_fkey') THEN
    ALTER TABLE "PchFournisseurProduit" ADD CONSTRAINT "PchFournisseurProduit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
