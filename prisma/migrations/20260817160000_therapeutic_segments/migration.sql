-- SEGMENTS THÉRAPEUTIQUES d'un dossier réglementaire — une LISTE, pas un texte.
-- Un produit sert souvent plusieurs segments, et « Oncologie, Gynéco » écrit à la main ne se
-- compte ni ne se filtre. Idempotent.
ALTER TABLE "RegulatoryProduct"
  ADD COLUMN IF NOT EXISTS "therapeuticSegments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
