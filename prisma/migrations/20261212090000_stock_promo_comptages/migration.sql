-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- STOCK PROMOTIONNEL, ÉTAPE 5 — COMPTAGES, ALERTES, TABLEAU DE BORD, REFONTES (§118.168)
--
-- Le directeur des opérations DEMANDE des comptages (ponctuels ou récurrents, par famille) ;
-- celui qui détient le matériel compte, et chaque écart devient une correction au registre qui
-- porte son comptage. Les alertes partent à l'entrée dans un état (seuil, rupture, péremption à
-- 30 jours, dotation non confirmée, comptage en retard), une fois. Les supports durables reçoivent
-- des propositions de refonte, que la Direction Marketing retient ou écarte.
--
-- Idempotente : chaque création se vérifie avant de se faire. Aucune donnée existante n'est
-- touchée : les tables sont neuves, et la colonne ajoutée au registre naît vide.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE "PromoComptageStatut" AS ENUM ('DEMANDE', 'SAISI', 'ANNULE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoComptageFrequence" AS ENUM ('HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoComptageCible" AS ENUM ('PERSONNE', 'EQUIPE', 'MAGASIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoRefonteStatut" AS ENUM ('OUVERTE', 'RETENUE', 'ECARTEE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PromoStockComptageRecurrence" (
  "id" TEXT NOT NULL,
  "cible" "PromoComptageCible" NOT NULL,
  "holderId" TEXT,
  "famille" "PromoFamille",
  "frequence" "PromoComptageFrequence" NOT NULL,
  "ancreLe" TIMESTAMP(3) NOT NULL,
  "prochaineLe" TIMESTAMP(3) NOT NULL,
  "delaiJours" INTEGER NOT NULL DEFAULT 7,
  "note" TEXT,
  "auteurId" TEXT,
  "actif" BOOLEAN NOT NULL DEFAULT true,
  "pauseMotif" TEXT,
  "pauseLe" TIMESTAMP(3),
  "derniereLe" TIMESTAMP(3),
  "nbDeclenchements" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoStockComptageRecurrence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoStockComptageRecurrence_actif_prochaineLe_idx" ON "PromoStockComptageRecurrence"("actif", "prochaineLe");
CREATE INDEX IF NOT EXISTS "PromoStockComptageRecurrence_auteurId_idx" ON "PromoStockComptageRecurrence"("auteurId");

CREATE TABLE IF NOT EXISTS "PromoStockComptage" (
  "id" TEXT NOT NULL,
  "holderId" TEXT,
  "famille" "PromoFamille",
  "demandeurId" TEXT NOT NULL,
  "recurrenceId" TEXT,
  "statut" "PromoComptageStatut" NOT NULL DEFAULT 'DEMANDE',
  "echeance" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "saisiLe" TIMESTAMP(3),
  "saisiParId" TEXT,
  "annuleLe" TIMESTAMP(3),
  "annuleParId" TEXT,
  "annuleMotif" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoStockComptage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoStockComptage_holderId_statut_idx" ON "PromoStockComptage"("holderId", "statut");
CREATE INDEX IF NOT EXISTS "PromoStockComptage_statut_echeance_idx" ON "PromoStockComptage"("statut", "echeance");
CREATE INDEX IF NOT EXISTS "PromoStockComptage_recurrenceId_statut_idx" ON "PromoStockComptage"("recurrenceId", "statut");
CREATE INDEX IF NOT EXISTS "PromoStockComptage_demandeurId_idx" ON "PromoStockComptage"("demandeurId");

CREATE TABLE IF NOT EXISTS "PromoStockComptageLigne" (
  "id" TEXT NOT NULL,
  "comptageId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "attendu" DECIMAL(12,3) NOT NULL,
  "compte" DECIMAL(12,3) NOT NULL,
  "ecart" DECIMAL(12,3) NOT NULL,
  CONSTRAINT "PromoStockComptageLigne_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromoStockComptageLigne_comptageId_itemId_key" ON "PromoStockComptageLigne"("comptageId", "itemId");
CREATE INDEX IF NOT EXISTS "PromoStockComptageLigne_itemId_idx" ON "PromoStockComptageLigne"("itemId");

CREATE TABLE IF NOT EXISTS "PromoStockAlerte" (
  "cle" TEXT NOT NULL,
  "envoyeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoStockAlerte_pkey" PRIMARY KEY ("cle")
);

CREATE TABLE IF NOT EXISTS "PromoStockRefonte" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "auteurId" TEXT NOT NULL,
  "motif" TEXT NOT NULL,
  "statut" "PromoRefonteStatut" NOT NULL DEFAULT 'OUVERTE',
  "decideParId" TEXT,
  "decideLe" TIMESTAMP(3),
  "noteDecision" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoStockRefonte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoStockRefonte_itemId_statut_idx" ON "PromoStockRefonte"("itemId", "statut");
CREATE INDEX IF NOT EXISTS "PromoStockRefonte_statut_idx" ON "PromoStockRefonte"("statut");

ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "comptageId" TEXT;
CREATE INDEX IF NOT EXISTS "PromoStockMovement_comptageId_idx" ON "PromoStockMovement"("comptageId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockComptage_recurrenceId_fkey') THEN
    ALTER TABLE "PromoStockComptage" ADD CONSTRAINT "PromoStockComptage_recurrenceId_fkey"
      FOREIGN KEY ("recurrenceId") REFERENCES "PromoStockComptageRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockComptageLigne_comptageId_fkey') THEN
    ALTER TABLE "PromoStockComptageLigne" ADD CONSTRAINT "PromoStockComptageLigne_comptageId_fkey"
      FOREIGN KEY ("comptageId") REFERENCES "PromoStockComptage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockComptageLigne_itemId_fkey') THEN
    ALTER TABLE "PromoStockComptageLigne" ADD CONSTRAINT "PromoStockComptageLigne_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockRefonte_itemId_fkey') THEN
    ALTER TABLE "PromoStockRefonte" ADD CONSTRAINT "PromoStockRefonte_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_comptageId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_comptageId_fkey"
      FOREIGN KEY ("comptageId") REFERENCES "PromoStockComptage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
