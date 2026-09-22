-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LES QUATRE NATURES DE POSTE QUE LA DIRECTION A NOMMÉES (22/09/2026)
--
-- « Dans les ajouts de poste dans les demandes Ad&Pro, ajouter : Sponsoring association, prise
-- en charge de la billetterie, prise en charge de l'hôtellerie, prise en charge des dîners. »
--
-- Elles existaient dans les faits et se saisissaient en « Autre » ou en « Prestation » : un
-- poste qu'on ne sait pas nommer se ventile mal, et le compte rendu de fin d'opération ne dit
-- plus de quoi le montant est fait.
--
-- ⚠️ IDEMPOTENT, et une valeur d'énumération ne se retire JAMAIS : des lignes la portent.
-- `ALTER TYPE … ADD VALUE IF NOT EXISTS` est la seule forme sûre — l'ordre des valeurs dans le
-- type n'a aucune importance ici, l'affichage étant gouverné par `ITEM_KINDS` côté code.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'ASSOCIATION_SUPPORT';
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'TICKETING';
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'ACCOMMODATION';
ALTER TYPE "AdProItemKind" ADD VALUE IF NOT EXISTS 'DINNER';
