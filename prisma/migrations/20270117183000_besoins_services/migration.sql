-- MARKETING COCKPIT · TERRAIN (Direction, 10/2026 — maquette validée « Ce qui dépend vraiment du terrain ») :
--   1. LE BESOIN ANNUEL D'UN SERVICE — le décideur (H) annonce les prévisions de son service, le KAM les saisit à la
--      visite ; une ligne par produit × établissement × service × année (service nul = l'établissement entier).
--   2. LE CACHE DU JOUR de « La voix du terrain » (regroupement des rapports par Luna, ou son repli par mots-clés).
--
-- Idempotente : rejouée, elle ne change plus rien.

-- 1. LES BESOINS ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BesoinAnnuelService" (
  "id"            TEXT NOT NULL,
  "productId"     TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "serviceId"     TEXT,
  "annee"         INTEGER NOT NULL,
  "quantite"      INTEGER NOT NULL,
  "decideurId"    TEXT,
  "note"          TEXT,
  "saisiParId"    TEXT NOT NULL,
  "saisiLe"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BesoinAnnuelService_pkey" PRIMARY KEY ("id")
);

-- UNE LIGNE PAR SERVICE ET PAR AN — même quand le service est nul (l'établissement entier) : NULLS NOT DISTINCT.
CREATE UNIQUE INDEX IF NOT EXISTS "BesoinAnnuelService_productId_institutionId_serviceId_annee_key"
  ON "BesoinAnnuelService" ("productId", "institutionId", "serviceId", "annee") NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS "BesoinAnnuelService_productId_annee_idx" ON "BesoinAnnuelService" ("productId", "annee");
CREATE INDEX IF NOT EXISTS "BesoinAnnuelService_institutionId_idx" ON "BesoinAnnuelService" ("institutionId");
CREATE INDEX IF NOT EXISTS "BesoinAnnuelService_decideurId_idx" ON "BesoinAnnuelService" ("decideurId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BesoinAnnuelService_productId_fkey') THEN
    ALTER TABLE "BesoinAnnuelService"
      ADD CONSTRAINT "BesoinAnnuelService_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BesoinAnnuelService_institutionId_fkey') THEN
    ALTER TABLE "BesoinAnnuelService"
      ADD CONSTRAINT "BesoinAnnuelService_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BesoinAnnuelService_serviceId_fkey') THEN
    ALTER TABLE "BesoinAnnuelService"
      ADD CONSTRAINT "BesoinAnnuelService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MedicalInstitutionService" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BesoinAnnuelService_decideurId_fkey') THEN
    ALTER TABLE "BesoinAnnuelService"
      ADD CONSTRAINT "BesoinAnnuelService_decideurId_fkey" FOREIGN KEY ("decideurId") REFERENCES "MedicalDoctor" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. LE CACHE DE LA VOIX DU TERRAIN ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VoixTerrainCache" (
  "cle"     TEXT NOT NULL,
  "jour"    TEXT NOT NULL,
  "contenu" JSONB NOT NULL,
  "parLuna" BOOLEAN NOT NULL DEFAULT false,
  "creeLe"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoixTerrainCache_pkey" PRIMARY KEY ("cle")
);
CREATE INDEX IF NOT EXISTS "VoixTerrainCache_jour_idx" ON "VoixTerrainCache" ("jour");
