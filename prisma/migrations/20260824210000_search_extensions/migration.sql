-- Extensions de recherche pour `search_everything` (My Chief of Staff) :
--   • unaccent : neutralise les accents CÔTÉ BASE (« Ténofovir » trouvé par « tenofovir ») ;
--   • pg_trgm  : similarité de trigrammes — rattrape les petites fautes de frappe.
-- Les deux sont FACULTATIVES : la couche applicative sonde leur présence à l'exécution et
-- retombe sur le LIKE strict si elles manquent. Ce bloc ne doit donc JAMAIS faire échouer un
-- déploiement — un rôle sans le droit CREATE EXTENSION passe son chemin, sans bruit.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS unaccent;
  EXCEPTION WHEN insufficient_privilege OR undefined_file THEN
    RAISE NOTICE 'extension unaccent indisponible — recherche stricte seulement';
  END;
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN insufficient_privilege OR undefined_file THEN
    RAISE NOTICE 'extension pg_trgm indisponible — pas de repli par similarité';
  END;
END $$;

-- Index trigrammes sur les colonnes les plus fouillées par la recherche fédérée. Créés
-- SEULEMENT si pg_trgm est là ; idempotents ; jamais bloquants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS "RegulatoryProduct_dci_trgm" ON "RegulatoryProduct" USING gin (lower("dci") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "RegulatoryProduct_brandName_trgm" ON "RegulatoryProduct" USING gin (lower("brandName") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "DriveNode_name_trgm" ON "DriveNode" USING gin (lower("name") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "LegalDocument_title_trgm" ON "LegalDocument" USING gin (lower("title") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "MedicalDoctor_name_trgm" ON "MedicalDoctor" USING gin (lower("name") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "MailEntry_title_trgm" ON "MailEntry" USING gin (lower("title") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "User_name_trgm" ON "User" USING gin (lower("name") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "Employee_fullName_trgm" ON "Employee" USING gin (lower("fullName") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "PaymentRequest_title_trgm" ON "PaymentRequest" USING gin (lower("title") gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "ExpenseOrder_label_trgm" ON "ExpenseOrder" USING gin (lower("label") gin_trgm_ops);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'index trigrammes non créés (%: %)', SQLSTATE, SQLERRM;
    END;
  END IF;
END $$;
