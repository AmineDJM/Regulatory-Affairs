-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- INFORMATION FABRIC — F2 : le CONTENU indexé devient réellement indexé.
--
-- ── LE GOULOT MESURÉ ──────────────────────────────────────────────────────────────────────
--
-- `DriveTextIndex.textFold` (≈20 000 caractères de texte extrait, replié) et
-- `KnowledgeChunk.textFold` sont fouillés par `contains` (LIKE '%…%') SANS AUCUN INDEX :
-- chaque `find_documents` et chaque retrieval du corpus paie un scan séquentiel du corpus
-- ENTIER. C'est le seul endroit du système où la latence croît linéairement avec la quantité
-- de documents — exactement ce que la fabric existe pour supprimer.
--
-- ── DEUX INDEX PAR TABLE, ET POURQUOI DEUX ───────────────────────────────────────────────
--
--   1. FTS (tsvector, config `simple`) — la VOIE PRINCIPALE : recherche par MOTS, classée
--      (ts_rank), préfixes (`pembro:*` trouve « pembrolizumab »). `simple` et non `french` :
--      le texte est déjà REPLIÉ (minuscules, sans accents) par l'application, et le corpus
--      mêle français, anglais et arabe — un stemming français y ferait plus de mal que de
--      bien. Index d'EXPRESSION : aucune colonne ajoutée, donc aucun impact sur Prisma ni sur
--      les écritures existantes ; la requête qui veut l'index répète l'expression, et elle
--      seule.
--   2. Trigrammes (gin_trgm_ops) — la CEINTURE : accélère les `contains` EXISTANTS tels
--      quels (pg_trgm sert les LIKE '%…%'), donc tout appelant non encore migré vers la FTS
--      profite déjà de l'index. Et il rattrape ce que la FTS ne sait pas : un fragment au
--      MILIEU d'un mot.
--
-- ── TOLÉRANT, COMME `search_extensions` ──────────────────────────────────────────────────
--
-- Même discipline que la migration 20260824210000 : un rôle sans CREATE EXTENSION, une infra
-- sans pg_trgm, et le déploiement PASSE — la couche applicative (fabric/text-search.ts) sonde
-- et replie sur le LIKE strict en le DISANT. Une recherche plus lente est un état ; un déploiement
-- cassé est une panne.
--
-- left(…, 250000) borne l'expression : tsvector plafonne à ~1 Mo et les positions à 16383 —
-- le texte applicatif est déjà borné à ~20 000 caractères, la borne SQL est la ceinture.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- ── FTS — ne dépend d'AUCUNE extension : tsvector est dans le cœur de Postgres. ─────────
  BEGIN
    CREATE INDEX IF NOT EXISTS "DriveTextIndex_textFold_fts"
      ON "DriveTextIndex" USING gin (to_tsvector('simple', left("textFold", 250000)));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'index FTS DriveTextIndex non créé (%: %)', SQLSTATE, SQLERRM;
  END;
  BEGIN
    CREATE INDEX IF NOT EXISTS "KnowledgeChunk_textFold_fts"
      ON "KnowledgeChunk" USING gin (to_tsvector('simple', left("textFold", 250000)));
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'index FTS KnowledgeChunk non créé (%: %)', SQLSTATE, SQLERRM;
  END;

  -- ── Trigrammes — seulement si l'extension est là. ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    BEGIN
      CREATE INDEX IF NOT EXISTS "DriveTextIndex_textFold_trgm"
        ON "DriveTextIndex" USING gin ("textFold" gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS "KnowledgeChunk_textFold_trgm"
        ON "KnowledgeChunk" USING gin ("textFold" gin_trgm_ops);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'index trigrammes contenu non créés (%: %)', SQLSTATE, SQLERRM;
    END;
  END IF;
END $$;
