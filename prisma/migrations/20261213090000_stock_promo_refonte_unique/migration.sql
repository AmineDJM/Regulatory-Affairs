-- §118.168 — au plus UNE proposition de refonte OUVERTE par personne et par article.
--
-- « La même idée deux fois ne pèse pas double » ne tenait que par une lecture suivie d'une
-- création : deux envois simultanés (double clic, deux onglets) lisaient tous deux « rien
-- d'ouvert » et créaient chacun leur proposition. Un index PARTIEL l'impose, comme celui des clés
-- du site (au plus une ACTIVE, une EN ATTENTE) : une fois tranchée, une proposition ne gêne plus
-- la suivante. Idempotente.
CREATE UNIQUE INDEX IF NOT EXISTS "PromoStockRefonte_une_ouverte"
  ON "PromoStockRefonte"("itemId", "auteurId")
  WHERE "statut" = 'OUVERTE';
