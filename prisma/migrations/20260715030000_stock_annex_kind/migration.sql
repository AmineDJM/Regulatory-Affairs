-- Réintroduction des « Annexes PCH » dans le module Stocks : le modèle StockAnnex porte désormais
-- deux types de lieux nommés (HÔPITAUX et ANNEXES PCH), distingués par la colonne `kind`.
-- Les lignes existantes sont des hôpitaux → défaut 'HOSPITAL'. SQL idempotent.

ALTER TABLE "StockAnnex" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'HOSPITAL';

CREATE INDEX IF NOT EXISTS "StockAnnex_kind_idx" ON "StockAnnex"("kind");
