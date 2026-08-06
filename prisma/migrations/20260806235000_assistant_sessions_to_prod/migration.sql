-- Sessions de l'assistant (fils de conversation + historique) : passage en PRODUCTION.
--
-- La nouveauté était livrée depuis un moment mais restait au stade TEST, donc visible des
-- seuls comptes en mode test. Les conversations, elles, étaient DÉJÀ enregistrées pour tout
-- le monde (`rememberExchange` n'a jamais été conditionné au drapeau) : la promotion rend
-- simplement visible un historique qui existait déjà, elle ne crée rien.
--
-- Idempotent : ne touche que la ligne du drapeau, seulement si elle existe et n'est pas déjà
-- en PROD. Le retour arrière reste immédiat depuis /admin/versions (repasser en TEST ou OFF).
UPDATE "FeatureFlag"
SET "stage" = 'PROD'
WHERE "key" = 'assistant_memory' AND "stage" <> 'PROD';

-- Si le drapeau n'a jamais été touché (base neuve), on le crée directement en PROD plutôt
-- que de laisser l'auto-création le poser en TEST au premier appel.
INSERT INTO "FeatureFlag" ("id", "key", "label", "description", "stage", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'assistant_memory',
  'Assistant — mémoire personnelle',
  'L''assistant se souvient des conversations passées de CHAQUE personne (fils persistants, mémoire distillée) et connaît son identité, son département et son N+1. Cloisonnement strict : personne ne peut atteindre la mémoire d''un autre.',
  'PROD',
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "FeatureFlag" WHERE "key" = 'assistant_memory');
