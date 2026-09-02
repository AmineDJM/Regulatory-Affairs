-- ════════════════════════════════════════════════════════════════════════════════════════════
-- UNE PIÈCE RÉCLAMÉE QUI EST UNE FACTURE OU UN BON DE COMMANDE REJOINT LEGAL.
--
-- On réclamait une facture depuis un dossier, la personne la déposait, on l'acceptait — et elle
-- restait dans le fil de la demande. Le registre des engagements de la société ne la connaissait
-- pas. Six mois plus tard, « quelles factures avons-nous reçues de ce fournisseur ? » n'avait pas
-- de réponse : la moitié d'entre elles dormaient dans des fils de discussion.
--
-- La demande de pièce DIT désormais SA NATURE (`kind`, même vocabulaire qu'une pièce de dossier
-- de paiement), et l'acceptation classe la pièce dans Legal quand cette nature engage la société.
-- `legalDocumentId` retient où elle est allée : le classement devient idempotent et traçable.
--
-- AUCUNE REPRISE DE L'EXISTANT, et c'est une décision. Les demandes déjà closes n'ont jamais
-- déclaré leur nature ; la deviner d'après le libellé (« la facture de… ») verserait dans le
-- registre des engagements des pièces choisies par une correspondance de texte — un contrat pris
-- pour une facture, une phrase mal lue devenant un engagement de la société. Ce qui manque au
-- registre y sera porté à la main, en le sachant.
-- ════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "DocumentRequest" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "DocumentRequest" ADD COLUMN IF NOT EXISTS "legalDocumentId" TEXT;
