-- ════════════════════════════════════════════════════════════════════════════════════════════
-- REMETTRE UNE CAISSE D'AVANCE EST UN DÉCAISSEMENT — et il n'était pas comptabilisé.
--
-- L'argent quittait la banque pour alimenter la caisse d'un service, et le livre n'en savait
-- rien : le solde comptable et le solde bancaire divergeaient d'autant, et l'écart ne se
-- découvrait qu'au rapprochement, un mois plus tard, sur un relevé entier.
--
-- Les DÉPENSES de la caisse, elles, étaient bien suivies (ligne de budget de département) : ce
-- qui manquait était la SORTIE initiale, celle qui fait exister le fond.
--
-- Cette colonne relie chaque remise à son écriture. Les remises ANTÉRIEURES restent à `NULL` :
-- on n'invente pas rétroactivement une écriture datée, avec un montant et un compte, dans le
-- livre comptable — c'est le contrôle du livre (`lib/finance/ledger-audit.ts`) qui les signale,
-- pour qu'un humain les passe en connaissance de cause.
-- ════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "PettyCashAllotment" ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
