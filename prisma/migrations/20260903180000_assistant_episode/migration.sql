-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- L'ÉPISODE — une TRANCHE de conversation, compressible par étapes (§92-94).
--
-- ── POURQUOI CE MODÈLE N'EST PAS REDONDANT ────────────────────────────────────────────────
--
-- Trois objets de mémoire coexistent déjà, et aucun ne fait ce travail :
--
--   `AssistantMemory`     — UN résumé par personne. Un seul bloc, réécrit à chaque distillation :
--                           il ne peut pas porter « ce qui s'est dit en mars » distinctement de
--                           « ce qui s'est dit hier ». C'est précisément l'écrasement que §93
--                           interdit.
--   `AssistantMemoryItem` — des faits DURABLES et typés (alias, préférences, principes). Ils ne
--                           vieillissent pas et ne se compressent pas : ce sont des vérités, pas
--                           des souvenirs.
--   `AssistantMessage`    — les tours bruts. Les garder tous et les renvoyer à chaque fois est
--                           exactement le comportement que §90 proscrit.
--
-- L'épisode est le chaînon manquant : daté, borné à un intervalle de messages, et dont la
-- FIDÉLITÉ décroît avec l'âge sans jamais perdre ce qui compte (entités, décisions, engagements,
-- montants, échéances, questions restées ouvertes).
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "AssistantEpisode" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL,
  "threadId"      TEXT,
  -- RICH | STRUCTURED | FACTS — la fidélité actuelle, qui ne remonte jamais.
  "fidelity"      TEXT NOT NULL DEFAULT 'RICH',
  "summary"       TEXT NOT NULL,
  -- CE QUI SURVIT À TOUTES LES COMPRESSIONS. Le point entier du §94 : un résumé qui perd
  -- l'identifiant d'un marché ou le montant d'une facture a détruit ce qu'on voulait garder.
  "entities"      JSONB NOT NULL DEFAULT '[]',
  "decisions"     JSONB NOT NULL DEFAULT '[]',
  "commitments"   JSONB NOT NULL DEFAULT '[]',
  "openQuestions" JSONB NOT NULL DEFAULT '[]',
  "corrections"   JSONB NOT NULL DEFAULT '[]',
  -- Les bornes de la tranche : de quel message à quel message.
  "fromMessageId" TEXT,
  "toMessageId"   TEXT,
  "turns"         INTEGER NOT NULL DEFAULT 0,
  "tokensBefore"  INTEGER NOT NULL DEFAULT 0,
  "tokensAfter"   INTEGER NOT NULL DEFAULT 0,
  "startedAt"     TIMESTAMP(3) NOT NULL,
  "endedAt"       TIMESTAMP(3) NOT NULL,
  "compactedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantEpisode_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AssistantEpisode_user_ended_idx" ON "AssistantEpisode"("userId", "endedAt" DESC);
CREATE INDEX IF NOT EXISTS "AssistantEpisode_thread_idx" ON "AssistantEpisode"("threadId", "endedAt" DESC);
CREATE INDEX IF NOT EXISTS "AssistantEpisode_fidelity_idx" ON "AssistantEpisode"("userId", "fidelity");

-- Une tranche donnée n'est compactée qu'UNE fois : sans cette unicité, deux passes du
-- compacteur produiraient deux souvenirs du même moment, et le contexte les compterait deux fois.
CREATE UNIQUE INDEX IF NOT EXISTS "AssistantEpisode_span_key"
  ON "AssistantEpisode"("userId", "fromMessageId", "toMessageId")
  WHERE "fromMessageId" IS NOT NULL AND "toMessageId" IS NOT NULL;
