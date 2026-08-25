-- Confirmation renforcée des actions CRITIQUES : la valeur à RESSAISIR est stockée sur l'intent
-- à la proposition — le serveur la compare lui-même à l'exécution (l'UI n'est plus l'autorité).
ALTER TABLE "AssistantActionIntent" ADD COLUMN IF NOT EXISTS "confirmText" TEXT;
