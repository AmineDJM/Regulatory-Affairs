-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LES HÔPITAUX DU MODULE STOCKS SONT CEUX DE L'ANNUAIRE DES ÉTABLISSEMENTS (§118.134).
--
-- Décision de la Direction : les hôpitaux et les produits qu'un KAM voit dans les stocks sont ceux
-- de l'annuaire des établissements qui sont dans SON secteur, dans SA BU ; le National Sales voit
-- toute sa BU. Un secteur est une sélection d'établissements de l'annuaire (`SalesSectorInstitution`)
-- — donc un lieu de stock « hôpital » doit désigner un établissement, sinon aucune portée ne peut
-- se calculer.
--
-- `StockAnnex` gardait ses hôpitaux comme des NOMS libres, un second registre à côté de l'annuaire
-- (« CHU Mustapha » ici, « C.H.U Mustapha » là). On ne remplace pas la table : les relevés, les
-- récurrences et leurs clés étrangères la visent, et l'historique doit survivre. On la RELIE.
--
-- Nul = lieu HÉRITÉ, à rattacher à la main depuis l'écran (Super Admin). Aucun rattachement
-- automatique par ressemblance de nom : deux établissements peuvent porter le même nom, et joindre
-- l'historique d'un hôpital à un autre serait un faux succès silencieux (§104.7).
--
-- `ON DELETE SET NULL` : retirer un établissement de l'annuaire n'efface pas des relevés.
-- IDEMPOTENTE, comme toute migration de ce dépôt.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "StockAnnex" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StockAnnex_institutionId_key"
  ON "StockAnnex" ("institutionId");

DO $$ BEGIN
  ALTER TABLE "StockAnnex"
    ADD CONSTRAINT "StockAnnex_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
