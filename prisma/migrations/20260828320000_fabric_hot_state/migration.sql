-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- INFORMATION FABRIC — F5 : les ÉTATS CHAUDS précalculés (matérialisation par écriture).
--
-- ── LE COÛT QUE CETTE TABLE SUPPRIME ─────────────────────────────────────────────────────
--
-- Les signaux exécutifs (« qu'est-ce qui cloche ? ») se recalculaient à CHAQUE appel de
-- company_state / ceo_attention / executive_brief : treize requêtes dont un balayage de
-- relevés de stock — payées à la question, plusieurs fois par jour, pour un résultat qui
-- bouge à l'échelle de la journée. Ici, le résultat est PERSISTÉ avec son instant de calcul
-- et son coût MESURÉ : la question devient une lecture d'une ligne.
--
-- ── CE QUE LE SCHÉMA GARANTIT ────────────────────────────────────────────────────────────
--
-- `subjectId` est la CLÉ DE DROITS : un état calculé pour une personne (son périmètre
-- d'entité, ses engagements personnels) n'est JAMAIS servi à une autre (§25 du mandat :
-- l'omniscience ne contourne pas les droits). `staleAt` porte l'invalidation par ÉVÉNEMENT
-- (un fait métier inscrit au registre marque les états périmés) ; `computedAt` porte le TTL.
-- `costMs` est la PREUVE : ce que le précalcul économise se lit, il ne s'affirme pas.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "AssistantHotState" (
  "id"         TEXT NOT NULL,
  "kind"       TEXT NOT NULL,
  "subjectId"  TEXT NOT NULL,
  "payload"    JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "costMs"     INTEGER NOT NULL,
  "staleAt"    TIMESTAMP(3),
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantHotState_pkey" PRIMARY KEY ("id")
);

-- Un état par (nature, sujet) — l'écriture est un upsert, jamais une accumulation.
CREATE UNIQUE INDEX IF NOT EXISTS "AssistantHotState_kind_subjectId_key"
  ON "AssistantHotState" ("kind", "subjectId");
-- L'invalidation par événement marque TOUS les états d'une nature — servie par index.
CREATE INDEX IF NOT EXISTS "AssistantHotState_kind_staleAt_idx"
  ON "AssistantHotState" ("kind", "staleAt");
