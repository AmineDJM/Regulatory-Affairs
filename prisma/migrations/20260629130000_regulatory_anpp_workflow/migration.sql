-- Suivi du processus officiel ANPP (22 étapes) + checklist de présoumission (JSON par produit).
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "workflow"  JSONB;
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "checklist" JSONB;
