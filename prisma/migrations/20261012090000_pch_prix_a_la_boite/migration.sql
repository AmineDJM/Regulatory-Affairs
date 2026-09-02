-- ════════════════════════════════════════════════════════════════════════════════════════════
-- LE MARCHÉ COMPTE EN UNITÉS, NOUS VENDONS EN BOÎTES.
--
-- Un appel d'offres PCH demande « 8 000 comprimés ». Nous soumissionnons une BOÎTE de 30 à un
-- prix, et nous la payons un autre prix à notre fournisseur. Le module ne connaissait que le prix
-- À L'UNITÉ : on divisait de tête avant de saisir, et le chiffre réellement négocié — le prix de
-- la boîte — n'existait nulle part. Notre COÛT, lui, n'était pas saisi du tout : on déposait sans
-- savoir si le lot était gagnant.
--
-- Trois colonnes, et une règle : QUAND LE PRIX DE BOÎTE EST SAISI, IL FAIT FOI, et le prix
-- unitaire s'en déduit (`lib/pch/box-economics.ts`). L'inverse ferait de 1 000 DZD la boîte de 30
-- un prix unitaire de 33,33 puis une boîte à 999,90 — un centime perdu à chaque aller-retour sur
-- le seul chiffre que l'équipe reconnaît.
--
-- AUCUNE REPRISE : les lignes existantes gardent leur prix unitaire, et leur prix de boîte se
-- RECONSTRUIT à l'affichage. L'écrire en base figerait l'arrondi et le ferait dériver.
-- ════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "boxPriceDzd" DECIMAL(14,2);
ALTER TABLE "PchTenderLine" ADD COLUMN IF NOT EXISTS "boxCostDzd" DECIMAL(14,2);

ALTER TABLE "PchOrderLine" ADD COLUMN IF NOT EXISTS "unitsPerBox" INTEGER;
ALTER TABLE "PchOrderLine" ADD COLUMN IF NOT EXISTS "boxPriceDzd" DECIMAL(14,2);
