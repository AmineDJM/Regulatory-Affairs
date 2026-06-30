-- Uniformise la casse des DCI des dossiers réglementaires en MAJUSCULES.
-- (DCI canonique + liste structurée des molécules d'une association.)

-- DCI canonique : MAJUSCULES, espaces normalisés autour des « + », espaces réduits.
UPDATE "RegulatoryProduct"
SET dci = regexp_replace(
            regexp_replace(upper(btrim(dci)), '\s*\+\s*', ' + ', 'g'),
            '\s+', ' ', 'g'
          )
WHERE dci IS NOT NULL
  AND dci <> regexp_replace(
                regexp_replace(upper(btrim(dci)), '\s*\+\s*', ' + ', 'g'),
                '\s+', ' ', 'g'
              );

-- Liste des molécules (JSONB array) : chaque élément en MAJUSCULES, espaces réduits.
UPDATE "RegulatoryProduct"
SET molecules = (
  SELECT jsonb_agg(regexp_replace(upper(btrim(value)), '\s+', ' ', 'g'))
  FROM jsonb_array_elements_text("molecules") AS value
)
WHERE "molecules" IS NOT NULL
  AND jsonb_typeof("molecules") = 'array'
  AND jsonb_array_length("molecules") > 0;
