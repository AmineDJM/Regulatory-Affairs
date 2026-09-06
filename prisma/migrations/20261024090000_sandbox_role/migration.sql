-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE RÔLE DU BAC À SABLE SQL (mandat 4 §25) — un rôle SANS droit d'écriture, pris par
-- `SET LOCAL ROLE amd_sandbox_ro` dans la transaction en lecture seule. Deux verrous valent
-- mieux qu'un : la transaction READ ONLY refuse déjà toute écriture ; le rôle refuse en plus
-- ce qu'une transaction ne couvre pas (fonctions à effet, tables système).
--
-- BEST-EFFORT ET IDEMPOTENT : sur un hébergeur qui ne laisse pas créer de rôle (Render,
-- Neon en plan de base), le bloc se termine sans erreur et le bac à sable DIT qu'il tourne
-- sur la transaction seule (`isolation: transaction_lecture_seule`). Rien n'est supposé.
-- ═══════════════════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'amd_sandbox_ro') THEN
    BEGIN
      CREATE ROLE amd_sandbox_ro NOLOGIN NOINHERIT;
    EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN
      RAISE NOTICE 'amd_sandbox_ro non créé (droits insuffisants) : la transaction en lecture seule reste le verrou';
      RETURN;
    END;
  END IF;
  BEGIN
    EXECUTE format('GRANT USAGE ON SCHEMA public TO amd_sandbox_ro');
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA public TO amd_sandbox_ro');
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO amd_sandbox_ro');
    EXECUTE format('GRANT amd_sandbox_ro TO %I', current_user);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'droits du rôle amd_sandbox_ro incomplets (%): la transaction en lecture seule reste le verrou', SQLERRM;
  END;
END $$;
