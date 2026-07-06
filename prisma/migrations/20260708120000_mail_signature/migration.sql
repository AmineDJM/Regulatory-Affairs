-- Signature e-mail par boîte (webmail) : ajoutée en bas des nouveaux messages.
-- Idempotent.
ALTER TABLE "MailAccount" ADD COLUMN IF NOT EXISTS "signature" TEXT;
