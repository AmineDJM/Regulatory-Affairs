-- Clés VAPID (Web Push) persistées : auto-générées si l'environnement n'en fournit pas.
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "vapidPublicKey" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "vapidPrivateKey" TEXT;
