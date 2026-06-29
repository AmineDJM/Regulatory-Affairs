-- DCI : parfois une seule molécule, parfois une association (double, triple…).
-- On conserve "dci" comme libellé canonique (molécules jointes par " + ") et on
-- stocke en plus la liste structurée des molécules pour l'affichage/édition.
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "molecules" JSONB;
