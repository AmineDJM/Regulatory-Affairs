-- Nouveau type de job : EXAMEN VISUEL des pages.
--
-- Il répond à une question sur laquelle l'analyse de texte est structurellement aveugle :
-- « qu'est-ce que je VOIS ? ». L'OCR d'une capture d'écran rend un texte parfaitement propre —
-- seule l'image révèle qu'il ne s'agit pas du document authentique. Même chose pour une photo
-- d'écran, un scan illisible, un filigrane « brouillon » ou une signature manquante.
--
-- Idempotent : ADD VALUE IF NOT EXISTS ne fait rien si la valeur est déjà présente.
ALTER TYPE "RegJobType" ADD VALUE IF NOT EXISTS 'VISION';
