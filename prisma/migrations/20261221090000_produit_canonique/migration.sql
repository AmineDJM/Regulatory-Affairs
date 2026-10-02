-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- LE PRODUIT CANONIQUE BRANCHÉ (§118.178)
--
-- Un dossier à l'identité complète rejoint son produit canonique à la création et à chaque
-- modification ; ses produits de BU et de BD hérités le suivent. Deux ajouts, et aucune donnée
-- touchée :
--   • le type d'entité PRODUCT, pour que la création, la correction, les alias et le nom d'un
--     produit s'écrivent dans SON historique ;
--   • un index sur le lien `productId` des trois profils : le catalogue compte et liste les
--     profils d'un produit à chaque affichage.
--
-- AUCUN rattachement n'est fait ici : il se fait par l'application (clé d'identité calculée en
-- TypeScript, `src/lib/products/identity.ts`), à l'enregistrement de chaque dossier, et pour
-- l'existant par le geste « Rattacher automatiquement » du catalogue (Super Admin), avec aperçu.
--
-- IDEMPOTENTE. `ADD VALUE` n'est employé par aucune autre instruction de ce fichier : Postgres
-- refuse d'utiliser une valeur d'énumération dans la transaction qui l'ajoute.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'PRODUCT';

CREATE INDEX IF NOT EXISTS "RegulatoryProduct_productId_idx" ON "RegulatoryProduct"("productId");
CREATE INDEX IF NOT EXISTS "PromoProduct_productId_idx" ON "PromoProduct"("productId");
CREATE INDEX IF NOT EXISTS "BdProduct_productId_idx" ON "BdProduct"("productId");
