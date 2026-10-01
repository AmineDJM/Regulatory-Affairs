-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- STOCK PROMOTIONNEL, ÉTAPE 3 — LE MATÉRIEL REMIS EN VISITE (§118.166)
--
-- Une remise est un mouvement DISTRIBUTION qui sort du stock du délégué : il porte désormais la
-- VISITE où il a eu lieu et le MÉDECIN qui l'a reçu — l'historique de la fiche du praticien se lit
-- là, et nulle part ailleurs. Un support numérique présenté compte une utilisation dans sa propre
-- table, sans quantité.
--
-- RIEN N'EST REMPLI À LA PLACE DE PERSONNE : les remises d'avant le registre gardent leur texte
-- (`recipient`), sans visite ni médecin. Idempotente de bout en bout.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. La visite et le médecin d'une remise ─────────────────────────────────────────────
ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "visitId" TEXT;
ALTER TABLE "PromoStockMovement" ADD COLUMN IF NOT EXISTS "doctorId" TEXT;
CREATE INDEX IF NOT EXISTS "PromoStockMovement_visitId_idx" ON "PromoStockMovement"("visitId");
CREATE INDEX IF NOT EXISTS "PromoStockMovement_doctorId_idx" ON "PromoStockMovement"("doctorId");

-- ─── 2. Les supports numériques présentés ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MedicalVisitSupportNumerique" (
  "visitId"   TEXT NOT NULL,
  "itemId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MedicalVisitSupportNumerique_pkey" PRIMARY KEY ("visitId", "itemId")
);
CREATE INDEX IF NOT EXISTS "MedicalVisitSupportNumerique_itemId_idx" ON "MedicalVisitSupportNumerique"("itemId");

-- ─── 3. Les clés étrangères ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_visitId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_visitId_fkey"
      FOREIGN KEY ("visitId") REFERENCES "MedicalVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromoStockMovement_doctorId_fkey') THEN
    ALTER TABLE "PromoStockMovement" ADD CONSTRAINT "PromoStockMovement_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "MedicalDoctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalVisitSupportNumerique_visitId_fkey') THEN
    ALTER TABLE "MedicalVisitSupportNumerique" ADD CONSTRAINT "MedicalVisitSupportNumerique_visitId_fkey"
      FOREIGN KEY ("visitId") REFERENCES "MedicalVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MedicalVisitSupportNumerique_itemId_fkey') THEN
    ALTER TABLE "MedicalVisitSupportNumerique" ADD CONSTRAINT "MedicalVisitSupportNumerique_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "PromoStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
