-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- PROVENANCE AU NIVEAU DU FAIT (F8, mandat 4 §22) — une ligne par tour de conversation : les
-- faits servis, typés (source, date propre, lecture, confiance, fraîcheur, outil, calcul).
-- Cloisonnée par personne. Idempotent : rejouable sans effet.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "AssistantProvenance" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "threadId"  TEXT,
  "turnId"    TEXT,
  "question"  TEXT,
  "faits"     JSONB NOT NULL,
  "nombre"    INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantProvenance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AssistantProvenance_userId_createdAt_idx" ON "AssistantProvenance"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AssistantProvenance_threadId_createdAt_idx" ON "AssistantProvenance"("threadId", "createdAt");
