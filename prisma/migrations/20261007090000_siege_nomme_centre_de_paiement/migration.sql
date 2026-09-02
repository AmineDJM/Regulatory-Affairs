-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE SIÈGE NOMMÉ AU CENTRE DE PAIEMENT — une personne, désignée, et pas un rôle.
--
-- Siéger au centre était une propriété du RÔLE : Super Admin ou Direction. Faire entrer une
-- personne de plus n'avait donc qu'un seul chemin — lui donner le rôle Direction, c'est-à-dire
-- MANAGE sur tous les pôles, la vue globale sur les validations de toute l'entreprise et My Chief
-- of Staff. Pour quelqu'un qui doit autoriser des paiements, c'est hors de proportion.
--
-- Et les deux gestes qui SEMBLAIENT surgicaux ne marchaient pas, sans le dire : cocher le module
-- PAYMENT_CENTRE dans la grille d'accès (l'écran du centre ne consulte pas ce module) et poser
-- « autre rôle = Direction » (la règle lit le rôle PRINCIPAL). L'administrateur croyait avoir
-- accordé l'accès ; la personne trouvait un écran vide.
--
-- Le siège donne EXACTEMENT une chose : voir la file des autorisations et trancher. Aucun autre
-- module, aucune vue globale, aucun droit sur les Finances. Il porte SON AUTEUR et SON MOTIF —
-- un siège dont on ne sait ni qui l'a accordé ni pourquoi est un siège que personne n'ose retirer.
--
-- Idempotent : rejouable sans effet de bord. Aucune donnée existante n'est touchée — les sièges
-- se créent un par un, à la main, par le Super Admin.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "PaymentCentreSeat" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "grantedById" TEXT,
  "grantedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"        TEXT,
  CONSTRAINT "PaymentCentreSeat_pkey" PRIMARY KEY ("id")
);

-- UN SEUL SIÈGE PAR PERSONNE. Sans cette unicité, « retirer le siège » deviendrait ambigu : il y
-- en aurait deux, on en supprimerait un, et la personne siégerait toujours.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentCentreSeat_userId_key" ON "PaymentCentreSeat" ("userId");
CREATE INDEX IF NOT EXISTS "PaymentCentreSeat_grantedById_idx" ON "PaymentCentreSeat" ("grantedById");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentCentreSeat_userId_fkey') THEN
    -- CASCADE : supprimer un compte retire son siège. Un siège orphelin n'autoriserait personne,
    -- mais il resterait dans la liste et l'on croirait le cercle plus large qu'il n'est.
    ALTER TABLE "PaymentCentreSeat"
      ADD CONSTRAINT "PaymentCentreSeat_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentCentreSeat_grantedById_fkey') THEN
    -- SET NULL : désactiver ou supprimer un compte n'efface pas la trace de ce qu'il a accordé.
    ALTER TABLE "PaymentCentreSeat"
      ADD CONSTRAINT "PaymentCentreSeat_grantedById_fkey"
      FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
