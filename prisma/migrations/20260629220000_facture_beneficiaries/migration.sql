-- Facture obligatoire au règlement (dépenses événementielles).
ALTER TABLE "ExpenseOrder" ADD COLUMN IF NOT EXISTS "requiresInvoice" BOOLEAN NOT NULL DEFAULT false;

-- Personnes prises en charge (congrès national/international) + pièces d'identité.
ALTER TABLE "CongressInternational" ADD COLUMN IF NOT EXISTS "beneficiaries" JSONB;
ALTER TABLE "CongressNational" ADD COLUMN IF NOT EXISTS "beneficiaries" JSONB;

ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'ID_DOCUMENT';
