-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- ADAM EXISTE DANS L'ERP — et ne peut pas s'y connecter.
--
-- ── LA DEMANDE, ET LA TENSION QU'ELLE PORTE ──────────────────────────────────────────────
--
-- « Crée-lui son espace user de l'ERP, donne-lui les accès nécessaires de super admin complet
-- et total, et il faut qu'il puisse gérer son compte en full autonomie avec les accords. »
--
-- La même mission dit ailleurs, en toutes lettres : « NE crée pas un compte humain avec mot de
-- passe que l'agent peut manipuler », et interdit à l'agent de modifier ses permissions, de
-- s'attribuer un rôle ou de créer des identifiants.
--
-- Les deux sont tenables ENSEMBLE, et c'est ce que fait cette colonne. Adam obtient une PRÉSENCE
-- réelle — une ligne `User`, un rôle SUPER_ADMIN, un espace, des missions, des livrables, un
-- journal, une messagerie — et perd la seule chose qui ferait de lui un risque : la capacité de
-- SE CONNECTER, donc de contourner le runtime et ses gardes.
--
-- ── POURQUOI UNE COLONNE ET NON UNE CONVENTION DE NOM ────────────────────────────────────
--
-- Un « si l'e-mail commence par adam@ » est une convention : elle se contourne en renommant, et
-- elle s'oublie au prochain chemin d'authentification. `isSystem` est lu par le contrôle des
-- identifiants et par les opérations de compte : un refus de code, pas une politesse.
--
-- `passwordHash` reste NON NUL (la colonne l'exige) mais porte une valeur qui n'est le condensat
-- d'AUCUN mot de passe : `bcrypt.compare` rend faux quoi qu'on saisisse. La double protection
-- est volontaire — l'une tient si l'autre est oubliée.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "User_isSystem_idx" ON "User"("isSystem") WHERE "isSystem" = true;
