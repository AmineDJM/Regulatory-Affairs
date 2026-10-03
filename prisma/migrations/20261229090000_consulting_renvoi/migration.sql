-- Audit 360°, lot C4a : un contrat de consulting se RENVOIE pour correction à son porteur au lieu
-- d'être refusé (donc annulé pour toujours). Trois colonnes, effacées à la resoumission.
-- Idempotente : rejouée, elle ne change rien.
ALTER TABLE "ConsultingContract" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
ALTER TABLE "ConsultingContract" ADD COLUMN IF NOT EXISTS "returnedById" TEXT;
ALTER TABLE "ConsultingContract" ADD COLUMN IF NOT EXISTS "returnNote" TEXT;
