-- LE REJEU DE SESSION — la suite des actions d'une personne, pour le support technique.
--
-- Le support reçoit « ça ne marche pas », sans page, sans heure, sans manipulation. Le rejeu répond
-- à la seule question utile : qu'est-ce qui s'est passé, dans l'ordre, juste avant l'erreur.
--
-- Ce N'EST PAS une vidéo — un navigateur ne peut pas filmer l'écran sans autorisation explicite ni
-- indicateur visible, c'est une garantie du navigateur lui-même. On enregistre les ACTIONS.
--
-- ⚠️ AUCUNE VALEUR DE CHAMP n'entre ici : ni mot de passe, ni montant, ni contenu de message. Le
-- masquage est appliqué À L'ENTRÉE (src/lib/replay/capture.ts) et vérifié par ses tests — pas
-- laissé à la discipline de l'appelant.

CREATE TABLE IF NOT EXISTS "SessionEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT,
  "kind" TEXT NOT NULL,
  "at" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "label" TEXT,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SessionEvent_sessionId_at_idx" ON "SessionEvent"("sessionId", "at");
CREATE INDEX IF NOT EXISTS "SessionEvent_userId_createdAt_idx" ON "SessionEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SessionEvent_kind_idx" ON "SessionEvent"("kind");

-- `SET NULL` : désactiver un compte ne doit pas effacer l'historique de support qui le concerne.
DO $$ BEGIN
  ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
