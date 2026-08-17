-- Pièces jointes des DOCUMENTS LÉGAUX : le contrat signé, l'avenant, l'attestation d'assurance.
-- Comme pour les courriers, elles passent par la table `Document` commune (entityType/entityId),
-- qui porte déjà stockage, contrôle d'accès, miroir Drive et trace d'audit.
-- Idempotent : rejouable sur une instance déjà migrée.

DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'LEGAL_DOCUMENT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
