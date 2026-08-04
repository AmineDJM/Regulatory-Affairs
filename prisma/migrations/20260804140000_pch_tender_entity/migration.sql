-- Nouveau type d'entité polymorphe pour attacher des documents (appel d'offres, etc.)
-- à un marché PCH (PchTender). Idempotent — sûr à rejouer.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PCH_TENDER';
