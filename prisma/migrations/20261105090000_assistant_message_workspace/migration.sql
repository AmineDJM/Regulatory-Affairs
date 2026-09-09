-- CE QU'ADAM CONSTRUIT SURVIT À LA FERMETURE DE L'ONGLET.
--
-- `AssistantMessage` ne gardait que `role` + `content`. Les blocs de l'espace de travail —
-- tableaux, graphiques, cartes d'action, aperçus de pièces — vivaient uniquement dans l'état
-- React. En revenant, la personne retrouvait le TEXTE de la conversation et perdait l'écran.
--
-- Idempotent : `IF NOT EXISTS`, et la colonne est nullable — les tours déjà écrits restent
-- valides et s'affichent comme avant (texte seul), sans reprise de données.
ALTER TABLE "AssistantMessage" ADD COLUMN IF NOT EXISTS "workspace" JSONB;
