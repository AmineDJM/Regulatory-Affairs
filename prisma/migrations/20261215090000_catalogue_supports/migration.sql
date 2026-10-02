-- LE CATALOGUE PROMOTIONNEL, C'EST LA LISTE DES SUPPORTS — triée en trois familles (§118.173).
--
-- Décision de la Direction (01/10) : « le catalogue doit être plus simple ; ce sont les supports
-- déjà créés qui sont le catalogue, triés en trois familles ; on peut en ajouter par la suite ».
-- Les supports sont la liste des natures de matériel (`MaterialType`, le menu « Type de matériel »
-- des demandes) : chacun devient UN article du catalogue, dans la famille que `familleDuType` lui
-- donne — durables : présentoir, stand, banner ; numérique : vidéo ; tout le reste se remet et se
-- compte. Un banc compare cette liste à `familleDuType` et aux libellés de `MATERIAL_TYPE` : deux
-- classements du même support finiraient par diverger (§118.5).
--
-- IDEMPOTENTE et SANS DOUBLON. Un support n'est pas ajouté :
--   • si son identifiant déterministe (`catsupport-<TYPE>`) existe déjà — rejouer ne crée rien ;
--   • si un article porte déjà son NOM (casse, espaces de bord et accents mis à part) — un Super
--     Admin qui a créé « fiche poso » à la main ne doit pas en trouver deux ;
--   • si un article créé À LA MAIN porte déjà sa NATURE — le choix « Nature de support » du
--     formulaire d'avant était une déclaration explicite : « cet article EST ce support ».
-- Un article REPRIS de l'ancien stock (`reprise_…`, §118.164) ne compte pas pour ce dernier point :
-- sa nature venait de l'ancien article, souvent spécialisé par produit (« Fiche POSO Nivolex »),
-- et ne désigne pas le support lui-même. Rien n'est fusionné, renommé ni archivé : ce qui existait
-- reste tel quel (§118.85 — on ne rapproche pas deux articles sur la ressemblance de leur nom).
-- « Autres » n'est pas un support : il n'entre pas.
--
-- Les références suivent la série CAT-NNNN, après la plus haute existante, quatre chiffres AU MOINS,
-- jamais au plus (`lpad` TRONQUE une chaîne plus longue que sa cible, §118.147).

WITH supports(ordre, type, nom, famille, exige) AS (
  VALUES
    (1,  'FICHE_POSO',         'Fiche POSO',            'CONSOMMABLE', true),
    (2,  'ADV',                'ADV',                   'CONSOMMABLE', true),
    (3,  'FICHE_CONSEILS',     'Fiche conseils',        'CONSOMMABLE', false),
    (4,  'FICHE_GAMME',        'Fiche Gamme',           'CONSOMMABLE', false),
    (5,  'CARNET_BILAN',       'Carnet bilan',          'CONSOMMABLE', false),
    (6,  'BLOC_NOTE',          'Bloc-notes',            'CONSOMMABLE', false),
    (7,  'SOUS_MAINS',         'Sous-mains',            'CONSOMMABLE', false),
    (8,  'PORTE_CARTE_RDV',    'Porte-carte RDV',       'CONSOMMABLE', false),
    (9,  'STYLOS',             'Stylos',                'CONSOMMABLE', false),
    (10, 'CLE_USB',            'Clé USB',               'CONSOMMABLE', false),
    (11, 'SAC_A_DOS',          'Sac à dos',             'CONSOMMABLE', false),
    (12, 'POSTER',             'Poster',                'CONSOMMABLE', false),
    (13, 'CARTES_INVITATIONS', 'Cartes d''invitations', 'CONSOMMABLE', false),
    (14, 'CADEAUX_FIN_ANNEE',  'Cadeaux fin d''année',  'CONSOMMABLE', false),
    (15, 'PRESENTOIRE',        'Présentoir',            'DURABLE',     false),
    (16, 'STAND_BOOTH',        'Stand / Booth',         'DURABLE',     false),
    (17, 'BANNER',             'Banner',                'DURABLE',     false),
    (18, 'VIDEO',              'Vidéo',                 'NUMERIQUE',   false)
),
-- Le nom comparé sans casse, sans espaces de bord ni accents — pas d'extension `unaccent` requise.
-- Les majuscules accentuées sont pliées par `translate` lui-même : `lower` ne les abaisse pas sous
-- toutes les locales (une base en `C` laisse « É » tel quel).
existants AS (
  SELECT a.id, a."materialType"::text AS type,
         translate(lower(btrim(a.nom)), 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn') AS cle
  FROM "PromoCatalogueArticle" a
),
manquants AS (
  SELECT s.*, row_number() OVER (ORDER BY s.ordre) AS rang
  FROM supports s
  WHERE NOT EXISTS (SELECT 1 FROM existants e WHERE e.id = 'catsupport-' || s.type)
    AND NOT EXISTS (SELECT 1 FROM existants e
                    WHERE e.cle = translate(lower(btrim(s.nom)), 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'))
    AND NOT EXISTS (SELECT 1 FROM existants e WHERE e.type = s.type AND e.id NOT LIKE 'reprise\_%')
),
base AS (
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 5) AS INTEGER)), 0) AS n
  FROM "PromoCatalogueArticle" WHERE reference ~ '^CAT-[0-9]+$'
)
INSERT INTO "PromoCatalogueArticle"
  ("id", "reference", "nom", "famille", "materialType", "unite", "exigeProduit", "actif", "createdAt", "updatedAt")
SELECT 'catsupport-' || m.type,
       'CAT-' || lpad((b.n + m.rang)::text, GREATEST(4, length((b.n + m.rang)::text)), '0'),
       m.nom, m.famille::"PromoFamille", m.type::"MaterialType", 'pièce', m.exige, true,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM manquants m CROSS JOIN base b
ON CONFLICT DO NOTHING;
