-- LE BROUILLON DU BC D'UN DEVIS DE MATÉRIEL PROMOTIONNEL (Direction, 10/2026) : la génération — automatique à la dernière
-- validation, ou par le geste de repli — dépose un APERÇU sur le devis, sans numéro ; « Valider et envoyer aux Finances »
-- (le demandeur, ou le Super Admin) attribue le numéro NNN/DG/AAAA et émet le BC. Même forme que `AdProDevis.bcBrouillon`.
ALTER TABLE "PromoQuote" ADD COLUMN IF NOT EXISTS "bcBrouillon" JSONB;

-- « AUTRE ARTICLE » : un article saisi librement depuis une demande, absent du catalogue. Il vit dans le catalogue, ARCHIVÉ
-- (il ne se propose à personne) et marqué hors catalogue, jusqu'à ce qu'un gestionnaire du catalogue l'y ajoute.
ALTER TABLE "PromoCatalogueArticle" ADD COLUMN IF NOT EXISTS "horsCatalogue" BOOLEAN NOT NULL DEFAULT false;
