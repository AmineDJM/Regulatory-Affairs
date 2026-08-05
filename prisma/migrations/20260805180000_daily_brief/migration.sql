-- POINT DU MATIN de l'assistant : un texte par personne et par jour (fuseau d'Alger).
-- Cache strictement personnel — la contrainte d'unicité (userId, day) garantit un seul
-- appel IA par jour et par personne. Idempotent — sûr à rejouer.

CREATE TABLE IF NOT EXISTS "DailyBrief" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "day"       DATE NOT NULL,
  "text"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyBrief_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyBrief_userId_day_key" ON "DailyBrief"("userId", "day");
CREATE INDEX IF NOT EXISTS "DailyBrief_day_idx" ON "DailyBrief"("day");

DO $$ BEGIN
  ALTER TABLE "DailyBrief" ADD CONSTRAINT "DailyBrief_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
