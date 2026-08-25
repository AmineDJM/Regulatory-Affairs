-- INVITATION DE COMPTE — le chemin de création SANS mot de passe transmis : le compte est créé
-- inconnectable (hash aléatoire) et la personne définit SON mot de passe via un lien à usage
-- unique. Idempotent : rejouable sans effet sur une base à niveau.

CREATE TABLE IF NOT EXISTS "UserInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserInvite_token_key" ON "UserInvite"("token");
CREATE INDEX IF NOT EXISTS "UserInvite_userId_idx" ON "UserInvite"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserInvite_userId_fkey'
  ) THEN
    ALTER TABLE "UserInvite"
      ADD CONSTRAINT "UserInvite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
