-- RECHERCHE SÉMANTIQUE : vecteurs d'embedding (512 dimensions, JSONB) sur les sections du
-- corpus et les réserves ANPP. Le corpus est largement en ANGLAIS (ICH, EMA) et les dossiers en
-- FRANÇAIS : la recherche lexicale ne les fera jamais se rencontrer — « durée de conservation »
-- ne matche pas « shelf life ». Nullable : le remplissage est progressif (à l'ingestion + un
-- rattrapage borné à chaque passage du planificateur), et l'absence de vecteur laisse la
-- recherche lexicale seule, jamais en panne.
ALTER TABLE "RegulatorySourceSection" ADD COLUMN IF NOT EXISTS "embedding" JSONB;
ALTER TABLE "AnppReserve" ADD COLUMN IF NOT EXISTS "embedding" JSONB;
