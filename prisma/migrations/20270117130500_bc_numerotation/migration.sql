-- NUMÉROTATION DES BONS DE COMMANDE : « À partir du prochain BC généré, c'est BC : 037/DG/2026 » (Direction, 10/2026).
--
-- Format NNN/DG/AAAA, par ordre de GÉNÉRATION (le numéro est attribué à la validation de l'aperçu par le demandeur), remise à 001
-- chaque année civile. Le départ est une DONNÉE, pas une constante du code : deux écritures, toutes deux idempotentes et jamais
-- à reculons — rejouées, ou après que la série a dépassé 37, elles ne changent plus rien.
--
--   1. le PLANCHER du profil (`settings.numerotationDepart.BON_DE_COMMANDE.2026`) passe à 37 s'il est plus bas (un départ déjà
--      plus haut reste) — pour les sociétés dont le motif des bons de commande porte « /DG/ » ;
--   2. le COMPTEUR de l'année (`DocumentSequence`, nature PURCHASE_ORDER) est amené à 36 s'il est plus bas, et créé à 36 s'il
--      n'existe pas : le prochain numéro attribué est donc 037. Un compteur déjà plus loin continue ; un numéro attribué ne l'est
--      jamais deux fois (clé unique société/nature/année, incrément atomique).
--
-- Les numéros déjà attribués ne changent pas.
UPDATE "CompanyDocumentProfile"
SET "settings" = jsonb_set(
      COALESCE("settings", '{}'::jsonb),
      '{numerotationDepart}',
      COALESCE("settings"->'numerotationDepart', '{}'::jsonb)
        || jsonb_build_object(
             'BON_DE_COMMANDE',
             COALESCE("settings"->'numerotationDepart'->'BON_DE_COMMANDE', '{}'::jsonb) || jsonb_build_object('2026', 37)
           ),
      true
    ),
    "updatedAt" = now()
WHERE "settings" IS NOT NULL
  AND jsonb_typeof("settings") = 'object'
  AND ("settings"->'numerotation'->>'BON_DE_COMMANDE') ILIKE '%/DG/%'
  AND (
    ("settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026') IS NULL
    OR (CASE WHEN ("settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026') ~ '^[0-9]+$'
             THEN ("settings"->'numerotationDepart'->'BON_DE_COMMANDE'->>'2026')::numeric < 37
             ELSE false END)
  );

INSERT INTO "DocumentSequence" ("id", "companyId", "kind", "year", "last", "updatedAt")
SELECT 'bcnum' || md5(p."companyId" || clock_timestamp()::text || random()::text), p."companyId", 'PURCHASE_ORDER', 2026, 36, now()
FROM "CompanyDocumentProfile" p
WHERE p."settings" IS NOT NULL
  AND jsonb_typeof(p."settings") = 'object'
  AND (p."settings"->'numerotation'->>'BON_DE_COMMANDE') ILIKE '%/DG/%'
ON CONFLICT ("companyId", "kind", "year")
DO UPDATE SET "last" = GREATEST("DocumentSequence"."last", 36), "updatedAt" = now();
