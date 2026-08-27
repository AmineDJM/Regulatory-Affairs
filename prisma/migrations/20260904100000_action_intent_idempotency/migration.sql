-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LA CLÉ D'IDEMPOTENCE SUR LE CHEMIN CANONIQUE D'ÉCRITURE (§15).
--
-- `AssistantActionIntent` protégeait déjà du double-clic et de la reconnexion : la réclamation
-- atomique de l'état fait qu'un seul appel gagne le droit d'exécuter. Mais elle protégeait à
-- partir d'un intent DÉJÀ CRÉÉ.
--
-- Une mission, elle, peut mourir ENTRE la création de l'intent et son exécution — et la reprise
-- ne sait pas que l'intent existe. Sans cette colonne, elle en créerait un second, qui passerait
-- toutes les gardes puisque le premier n'a jamais été exécuté : le message partirait deux fois.
--
-- L'UNICITÉ VIT EN BASE, et non dans la discipline de l'appelant : c'est la seule forme de
-- garantie qui survit à deux processus concurrents. Les valeurs NULL restent multiples (règle
-- standard de Postgres), donc les millions d'intents de conversation ne sont pas concernés.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "AssistantActionIntent" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AssistantActionIntent_idempotencyKey_key"
  ON "AssistantActionIntent"("idempotencyKey");

-- Le lien vers la mission, pour l'historique et pour l'écran : « quelle action a produit ce
-- reçu ? » doit se répondre sans parcourir tous les intents de la personne.
ALTER TABLE "AssistantActionIntent" ADD COLUMN IF NOT EXISTS "missionId" TEXT;
CREATE INDEX IF NOT EXISTS "AssistantActionIntent_missionId_idx" ON "AssistantActionIntent"("missionId");
