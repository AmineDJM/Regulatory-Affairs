-- PREMIER NUMÉRO DE LA SÉRIE DES BONS DE COMMANDE : « commencer à partir du BC N° 032/DG/2026 » (Direction, 10/2026).
--
-- Le départ est un PLANCHER du compteur, jamais un recul (`settings.numerotationDepart`, par nature puis par année) : le
-- numéro attribué vaut max(dernier + 1, départ). Cette migration ne le pose QUE pour les sociétés dont le motif des bons
-- de commande porte « /DG/ » — la série de la Direction Générale, celle de « 012/DG/2026 » — et seulement tant qu'aucun
-- départ n'est déjà réglé pour 2026 : rejouée, ou corrigée à la main depuis la numérotation de la papeterie, elle ne
-- reprend rien. Aucun compteur n'est touché ici : un compteur déjà au-delà de 31 continue, et 2027 repart à 001.
--
-- Une société dont le motif n'est pas encore réglé n'est pas concernée : elle règle motif et premier numéro ensemble
-- (Legal › « Composer un bon de commande » › Numérotation), la fabrique ne devine pas la série d'une société.
UPDATE "CompanyDocumentProfile"
SET "settings" = jsonb_set(
      COALESCE("settings", '{}'::jsonb),
      '{numerotationDepart}',
      COALESCE("settings"->'numerotationDepart', '{}'::jsonb)
        || jsonb_build_object(
             'BON_DE_COMMANDE',
             COALESCE("settings"->'numerotationDepart'->'BON_DE_COMMANDE', '{}'::jsonb) || jsonb_build_object('2026', 32)
           ),
      true
    ),
    "updatedAt" = now()
WHERE "settings" IS NOT NULL
  AND jsonb_typeof("settings") = 'object'
  AND ("settings"->'numerotation'->>'BON_DE_COMMANDE') ILIKE '%/DG/%'
  AND ("settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026') IS NULL;
