-- Auto-accord si autorité (généralisation du « skip-demandeur ») : si le demandeur détient déjà
-- le rôle / la portée d'une étape intermédiaire, elle est approuvée automatiquement en son nom
-- (tracé). Colonne booléenne opt-in, défaut false ⇒ aucun changement de comportement. Idempotent.
ALTER TABLE "WorkflowStep" ADD COLUMN IF NOT EXISTS "autoApproveIfRequester" BOOLEAN NOT NULL DEFAULT false;
