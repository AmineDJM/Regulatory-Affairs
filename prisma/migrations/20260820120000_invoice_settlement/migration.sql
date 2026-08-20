-- TOUT PAIEMENT PASSE PAR LES FINANCES — la facture réglée y inscrit son mouvement.
--
-- Marquer une facture « réglée » posait une date sur la facture, et rien d'autre : l'argent
-- sortait (ou entrait) sans qu'aucune écriture n'apparaisse au module Finances. La trésorerie
-- et le budget ignoraient donc des règlements bien réels, et personne ne pouvait s'en rendre
-- compte autrement qu'en recoupant deux écrans à la main.
--
-- `direction` dit le SENS : `OUT` pour une facture reçue (la société paie), `IN` pour une
-- facture émise (elle encaisse). Défaut `OUT` — le cas le plus fréquent, et celui dont l'oubli
-- est le moins grave : une dépense comptée qui n'existe pas se voit, une recette inventée non.
-- `payer`/`recipient` sont du texte libre : deviner le sens d'un nom de société poserait des
-- écritures à l'envers, ce qui est pire qu'une écriture absente.
-- Idempotent : rejouable sur une instance déjà migrée.

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "direction"     TEXT NOT NULL DEFAULT 'OUT';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "transactionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_transactionId_key" ON "Invoice"("transactionId");

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "FinanceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Les factures DÉJÀ marquées réglées ne reçoivent PAS d'écriture rétroactive : inventer des
-- mouvements datés d'aujourd'hui pour des règlements passés fausserait la trésorerie du mois
-- en cours. Elles restent sans transaction, et se rattrapent en les dé-marquant puis re-marquant
-- si l'on veut l'écriture — geste explicite, tracé.
