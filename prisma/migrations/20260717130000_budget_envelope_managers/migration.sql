-- Gestion déléguée par enveloppe : l'admin peut accorder à des rôles/personnes précis la
-- GESTION du contenu d'une enveloppe (catégories, allocations, dépenses budgétaires), en
-- plus de la simple visualisation (accessRoles / accessUserIds). Idempotent.

ALTER TABLE "BudgetEnvelope" ADD COLUMN IF NOT EXISTS "managerRoles"   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "BudgetEnvelope" ADD COLUMN IF NOT EXISTS "managerUserIds" TEXT[] NOT NULL DEFAULT '{}';
