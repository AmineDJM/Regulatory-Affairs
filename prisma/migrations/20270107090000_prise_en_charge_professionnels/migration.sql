-- PRISE EN CHARGE — UNE SEULE LISTE DE PROFESSIONNELS PROPOSÉS (décision de la Direction, 04/10/2026).
--
-- Trois endroits disaient « qui est pris en charge » : `invitedDoctorIds` (les médecins cochés à la
-- création), `beneficiaries` (le JSON du bloc « Personnes prises en charge ») et `CareBeneficiary`
-- (le dossier de prise en charge, une ligne par personne, ses pièces et ses devis). La source unique
-- est `CareBeneficiary` ; cette migration y reprend ce que les deux autres portaient. Elle n'efface
-- RIEN : les deux colonnes d'avant restent en base, simplement plus écrites par l'écran.
--
-- Idempotente : identifiants déterministes (md5 de la demande et de l'élément) + `ON CONFLICT DO
-- NOTHING`, et un praticien déjà présent sur la demande n'est jamais ajouté une seconde fois.

-- 1. La fin d'une prise en charge NATIONALE (le début reste `date`).
ALTER TABLE "CongressNational" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

-- 2. Le JSON `beneficiaries` — national puis international. La migration du 06/08/2026
--    (`20260806160000_care_beneficiaries`) en avait déjà repris les éléments de l'époque, mais le bloc
--    « Personnes prises en charge » a continué d'écrire le JSON SEUL ensuite : ce sont ces éléments-là
--    qu'on reprend ici. Un élément de l'annuaire (doctorId d'un
--    praticien qui existe) devient une ligne d'annuaire ; sinon un profil libre (nom, qualité,
--    établissement). Un même praticien deux fois dans le JSON ne fait qu'une ligne.
INSERT INTO "CareBeneficiary" ("id", "congressNationalId", "doctorId", "lastName", "jobTitle", "institution", "position", "createdAt", "updatedAt")
SELECT DISTINCT ON (c."id", COALESCE(d."id", e->>'id'))
  'mig-ben-' || md5(c."id" || ':' || COALESCE(d."id", e->>'id', e->>'name')),
  c."id",
  d."id",
  CASE WHEN d."id" IS NULL THEN NULLIF(btrim(e->>'name'), '') END,
  NULLIF(btrim(e->>'role'), ''),
  CASE WHEN d."id" IS NULL THEN NULLIF(btrim(e->>'institution'), '') END,
  1000 + n.ord::int,
  now(), now()
FROM "CongressNational" c
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c."beneficiaries"::jsonb) = 'array' THEN c."beneficiaries"::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY AS n(e, ord)
LEFT JOIN "MedicalDoctor" d ON d."id" = e->>'doctorId'
WHERE (d."id" IS NOT NULL OR NULLIF(btrim(e->>'name'), '') IS NOT NULL)
  AND NOT (d."id" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "CareBeneficiary" b WHERE b."congressNationalId" = c."id" AND b."doctorId" = d."id"))
  -- Déjà repris par la migration du 06/08 (`mig_<demande>_<rang>`) : ne pas le reprendre une seconde fois.
  AND NOT EXISTS (SELECT 1 FROM "CareBeneficiary" b WHERE b."id" = 'mig_' || c."id" || '_' || n.ord::text)
ORDER BY c."id", COALESCE(d."id", e->>'id'), n.ord
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CareBeneficiary" ("id", "congressInternationalId", "doctorId", "lastName", "jobTitle", "institution", "position", "createdAt", "updatedAt")
SELECT DISTINCT ON (c."id", COALESCE(d."id", e->>'id'))
  'mig-ben-' || md5(c."id" || ':' || COALESCE(d."id", e->>'id', e->>'name')),
  c."id",
  d."id",
  CASE WHEN d."id" IS NULL THEN NULLIF(btrim(e->>'name'), '') END,
  NULLIF(btrim(e->>'role'), ''),
  CASE WHEN d."id" IS NULL THEN NULLIF(btrim(e->>'institution'), '') END,
  1000 + n.ord::int,
  now(), now()
FROM "CongressInternational" c
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c."beneficiaries"::jsonb) = 'array' THEN c."beneficiaries"::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY AS n(e, ord)
LEFT JOIN "MedicalDoctor" d ON d."id" = e->>'doctorId'
WHERE (d."id" IS NOT NULL OR NULLIF(btrim(e->>'name'), '') IS NOT NULL)
  AND NOT (d."id" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "CareBeneficiary" b WHERE b."congressInternationalId" = c."id" AND b."doctorId" = d."id"))
  -- Déjà repris par la migration du 06/08 (`mig_<demande>_<rang>`) : ne pas le reprendre une seconde fois.
  AND NOT EXISTS (SELECT 1 FROM "CareBeneficiary" b WHERE b."id" = 'mig_' || c."id" || '_' || n.ord::text)
ORDER BY c."id", COALESCE(d."id", e->>'id'), n.ord
ON CONFLICT ("id") DO NOTHING;

-- 3. `invitedDoctorIds` — les médecins cochés à la création. APRÈS le JSON : un praticien déjà repris
--    ci-dessus (ou déjà au dossier) ne revient pas en double.
INSERT INTO "CareBeneficiary" ("id", "congressNationalId", "doctorId", "position", "createdAt", "updatedAt")
SELECT DISTINCT ON (c."id", d."id")
  'mig-inv-' || md5(c."id" || ':' || d."id"), c."id", d."id", 2000 + n.ord::int, now(), now()
FROM "CongressNational" c
CROSS JOIN LATERAL unnest(c."invitedDoctorIds") WITH ORDINALITY AS n(doc, ord)
JOIN "MedicalDoctor" d ON d."id" = n.doc
WHERE NOT EXISTS (SELECT 1 FROM "CareBeneficiary" b WHERE b."congressNationalId" = c."id" AND b."doctorId" = d."id")
ORDER BY c."id", d."id", n.ord
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CareBeneficiary" ("id", "congressInternationalId", "doctorId", "position", "createdAt", "updatedAt")
SELECT DISTINCT ON (c."id", d."id")
  'mig-inv-' || md5(c."id" || ':' || d."id"), c."id", d."id", 2000 + n.ord::int, now(), now()
FROM "CongressInternational" c
CROSS JOIN LATERAL unnest(c."invitedDoctorIds") WITH ORDINALITY AS n(doc, ord)
JOIN "MedicalDoctor" d ON d."id" = n.doc
WHERE NOT EXISTS (SELECT 1 FROM "CareBeneficiary" b WHERE b."congressInternationalId" = c."id" AND b."doctorId" = d."id")
ORDER BY c."id", d."id", n.ord
ON CONFLICT ("id") DO NOTHING;
