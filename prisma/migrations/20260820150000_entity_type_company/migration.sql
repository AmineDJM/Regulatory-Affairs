-- L'ENTITÉ DEVIENT PORTEUSE DE PIÈCES — extrait du registre, attestation fiscale, statuts, RIB.
--
-- Ces pièces accompagnent la carte d'identité légale et fiscale : on les joint à un dossier en
-- même temps qu'on en recopie les numéros. Elles passent par la table `Document` commune, donc
-- même stockage, même contrôle d'accès et même journalisation que partout — à condition que le
-- type d'entité existe.
--
-- `ADD VALUE IF NOT EXISTS` dans un bloc DO : la valeur ne peut pas être ajoutée deux fois, et
-- le bloc rend la migration rejouable.

DO $$ BEGIN
  ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'COMPANY';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
