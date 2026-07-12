-- Détection MULTI-SECTIONS : un gros PDF consolidé (« Module 3.pdf ») contient plusieurs sections
-- CTD. On les stocke pour que la complétude ne signale pas ces sections comme « manquantes ».
-- Idempotent. Rétrocompatible (tableau vide par défaut).
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "containedSections" TEXT[] NOT NULL DEFAULT '{}'::text[];
