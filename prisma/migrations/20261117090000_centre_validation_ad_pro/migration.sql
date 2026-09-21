-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE CENTRE DE VALIDATION AD & PRO — la table du VISA, pour les natures sans étape de circuit.
--
-- Décision de la Direction (09/2026) : « Crée un centre de validation Ad&Pro pour le PDG et
-- super admin. On gère depuis là le seuil à partir duquel il faut une validation qui passe par
-- ce centre. Toute demande parmi les demandes Ad&Pro dont le budget total est au-dessus du seuil
-- nécessite de passer par là, comme les autres centres de validations. »
--
-- CE QUE CETTE MIGRATION NE FAIT PAS, et c'est essentiel :
--
--   • Elle NE TOUCHE PAS aux quatre circuits configurables. Cinq des sept natures portent déjà
--     la porte du Directeur Général — l'étape `dg` (§118.138) pour les quatre circuits,
--     `REVIEW_DG` pour le matériel promotionnel. Le centre les LIT là où elles sont. Retirer
--     l'étape `dg` pour tout ramener à cette table aurait orphelin les instances qui s'y
--     trouvent à cet instant — un `currentSlug` que plus aucune étape ne porte, c'est-à-dire le
--     circuit mort de §118.113 — et fait perdre le réglage par circuit.
--
--   • Elle ne pose AUCUN visa sur les demandes existantes. Un visa absent ne bloque pas
--     (`visaAutoriseAAvancer`) : sans cela, toutes les demandes de consulting et « autres » déjà
--     en base se seraient arrêtées net au déploiement, sans que personne ait rien décidé. C'est
--     la porte de CRÉATION et de SOUMISSION qui pose le visa.
--
-- Idempotente : `IF NOT EXISTS` partout, rejouable sans effet.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "AdProGateVisa" (
  "id"          TEXT NOT NULL,
  "entityType"  "EntityType" NOT NULL,
  "entityId"    TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  -- Le seuil EN VIGUEUR au moment où la porte s'est ouverte, FIGÉ. Sans lui, baisser le seuil
  -- rendrait toute décision passée inexplicable : on ne saurait plus pourquoi ce dossier-là est
  -- passé par le centre (§118.41).
  "threshold"   DECIMAL(14,2) NOT NULL,
  "amount"      DECIMAL(14,2),
  "decidedById" TEXT,
  "decidedAt"   TIMESTAMP(3),
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdProGateVisa_pkey" PRIMARY KEY ("id")
);

-- UN visa par demande : la clé d'unicité est ce qui rend la pose idempotente côté application
-- (un second passage de la porte retrouve le visa au lieu d'en créer un deuxième).
CREATE UNIQUE INDEX IF NOT EXISTS "AdProGateVisa_entityType_entityId_key"
  ON "AdProGateVisa" ("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "AdProGateVisa_status_idx" ON "AdProGateVisa" ("status");

-- `SET NULL` et non `CASCADE` : supprimer le compte de celui qui a décidé ne doit pas effacer la
-- DÉCISION. Un arbitrage de 5 M DZD qui disparaît parce que son auteur a quitté la société est
-- exactement la trace qu'un audit vient chercher.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdProGateVisa_decidedById_fkey'
  ) THEN
    ALTER TABLE "AdProGateVisa"
      ADD CONSTRAINT "AdProGateVisa_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
