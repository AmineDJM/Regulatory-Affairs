-- Pièces jointes des COURRIERS : le registre devient un objet auquel on attache des documents.
-- Les pièces passent par la table `Document` commune (entityType/entityId) — c'est elle qui
-- porte déjà le stockage, le miroir Drive, le contrôle d'accès et la trace d'audit.
-- Idempotent : rejouable sur une instance déjà migrée.

DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'MAIL_ENTRY';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
