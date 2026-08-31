-- La FACTURE devient une cible de liens (« Relier à… » des courriers — le recouvrement écrit
-- des courriers PAR facture). Idempotent : ADD VALUE IF NOT EXISTS.
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'INVOICE';
