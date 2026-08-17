-- Deux rôles de direction distincts :
--   GENERAL_MANAGER     — Directeur Général : tous les pouvoirs métier, mais ni la souveraineté
--                         du Super Admin (Administration, IA, impersonation) ni la supervision
--                         des demandes de validation de TOUT LE MONDE.
--   OPERATIONS_DIRECTOR — Directeur des Opérations : rôle à part, périmètre opérations.
-- Aucun compte existant n'est touché : ce sont des valeurs d'énumération EN PLUS.
-- Idempotent : rejouable sur une instance déjà migrée.

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GENERAL_MANAGER';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OPERATIONS_DIRECTOR';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
