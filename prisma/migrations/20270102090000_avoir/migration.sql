-- AVOIR (§118.195 — audit 360°, R15) : la correction d'une facture émise, sous son propre numéro.
-- Une valeur d'énumération neuve ne sert pas dans la transaction qui l'ajoute : cette migration ne fait
-- que l'ajouter, et rien ne l'emploie ici.
ALTER TYPE "LegalDocKind" ADD VALUE IF NOT EXISTS 'CREDIT_NOTE';
