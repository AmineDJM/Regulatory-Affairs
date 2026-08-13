-- VERROU sur un dossier réglementaire : invisible pour toute l'équipe, y compris la Direction.
-- Seul le Super Admin le voit et le déverrouille. Le filtre vit dans `scopeRegulatory` afin
-- qu'un dossier verrouillé ne ressorte par aucune autre porte (recherche, stocks, assistant…).
ALTER TABLE "RegulatoryProduct" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "RegulatoryProduct_isLocked_idx" ON "RegulatoryProduct" ("isLocked");

-- Le portefeuille « Sélection PF Produits » arrive VERROUILLÉ : c'est un arbitrage encore
-- confidentiel. État INITIAL du lot uniquement (identifiants « regpf… ») — Prisma n'applique
-- une migration qu'une fois, et le déverrouillage se décide ensuite au cadenas. Ne pas rejouer
-- ce script à la main : il reverrouillerait ce qui a été ouvert depuis.
UPDATE "RegulatoryProduct" SET "isLocked" = true WHERE id LIKE 'regpf%';
