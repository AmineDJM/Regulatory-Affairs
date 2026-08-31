-- LE CENTRE DE PAIEMENT DEVIENT LE GUICHET UNIQUE.
--
-- Jusqu'ici, un ordre de dépense au-dessous de 50 000 DZD — ou issu des moyens généraux — naissait
-- en `NOT_REQUIRED` et filait directement aux Finances : le centre n'en voyait jamais la couleur.
-- L'intention était bonne (ne pas faire viser une facture de 3 000 DZD par le PDG), l'effet ne
-- l'était pas : le centre n'avait aucune vue de ce que la société décaissait, et « combien sort ce
-- mois-ci » n'avait de réponse que dans l'écran de celui qui paie.
--
-- Cette migration fait entrer au centre les demandes DÉJÀ EN BASE qui ne sont pas encore réglées.
-- Sans elle, le centre s'ouvrirait sur un présent sans passé : les dossiers en cours resteraient
-- invisibles, payés sous l'ancienne règle sans que personne ne l'ait décidé.
--
-- CE QUI N'EST PAS TOUCHÉ, et c'est délibéré :
--   • les ordres déjà PAYÉS ou ANNULÉS — les rouvrir gèlerait des dossiers clos et réécrirait un
--     passé qui a été autorisé par le circuit d'alors ;
--   • les ordres déjà engagés auprès du centre (AWAITING, APPROVED, REFUSED, et les allers-retours)
--     — ils ont leur état, on ne le recommence pas.
--
-- Idempotent : rejouable sans effet de bord.

UPDATE "ExpenseOrder"
SET "centralStatus" = 'AWAITING'
WHERE "centralStatus" = 'NOT_REQUIRED'
  AND "status" IN ('PENDING', 'REVISION_REQUESTED');
