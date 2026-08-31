-- LES FACTURES SORTENT DES BONS DE COMMANDE ET DEVIENNENT DES PIÈCES À PART ENTIÈRE.
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────────────────────────────────
--
-- Une facture classée EN PIÈCE JOINTE d'un bon de commande n'est pas une pièce du dossier : c'est
-- un fichier. Elle n'a ni référence, ni montant, ni échéance, ni statut ; elle n'apparaît pas dans
-- la liste Legal quand on filtre par « Facture » ; elle ne peut pas être reliée à un marché ou à
-- un courrier de recouvrement ; et elle ne peut pas partir au règlement. Le bon de commande, lui,
-- se met à porter des pièces qui ne le concernent plus une fois la commande exécutée.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────────────────────────────────
--
-- Chaque pièce de catégorie FACTURE attachée à un document Legal de nature BON DE COMMANDE devient
-- un `LegalDocument` de nature `INVOICE`, et le fichier DÉMÉNAGE : il n'est pas recopié, il change
-- de dossier. Une pièce, un dossier.
--
-- ── CE QU'ELLE NE FAIT PAS, ET POURQUOI ────────────────────────────────────────────────────────
--
-- Elle ne remplit QUE ce qu'elle SAIT. Le titre vient du nom du fichier, l'entité et le dossier de
-- classement viennent du bon de commande, le déposant reste le déposant. La référence, le montant,
-- les dates et la contrepartie restent VIDES : les déduire du bon de commande donnerait des
-- chiffres plausibles et faux, et personne ne saurait ensuite lesquels ont été saisis et lesquels
-- ont été devinés. C'est l'assistante de direction qui complète — le rôle prévu.
--
-- La contrepartie du bon figure en NOTE, pas dans le champ : c'est un fait sur le BON, pas une
-- affirmation sur la facture.
--
-- ── LE LIEN VERS LE BON EST POSÉ, LUI ──────────────────────────────────────────────────────────
--
-- `chainFromId` reçoit le bon de commande d'origine. Ce n'est pas une déduction : le fichier était
-- littéralement rangé dedans. Sans ce lien, la sortie produirait des factures orphelines dont
-- l'origine ne vivrait plus que dans une phrase de note. Les AUTRES liens (marché, contrat,
-- courriers de relance) restent à poser à la main.
--
-- ── LA CONFIDENTIALITÉ SUIT LA PIÈCE ───────────────────────────────────────────────────────────
--
-- Un document Legal SANS lecteur désigné est ouvert à tout le module. Sortir une facture d'un bon
-- restreint sans recopier ses lecteurs l'aurait donc EXPOSÉE — silencieusement, à tout le monde.
-- Les lecteurs du bon sont recopiés sur la facture.
--
-- ── IDEMPOTENCE ET ANNULATION ──────────────────────────────────────────────────────────────────
--
-- Les identifiants créés sont DÉRIVÉS de ceux des pièces (`linv_` + id de la pièce) : rejouer la
-- migration ne crée rien en double, et l'on retrouve toujours de quelle pièce vient quel document.
-- Une fois la pièce déménagée, elle n'est plus attachée à un bon de commande — la requête ne la
-- voit donc plus.
--
-- POUR ANNULER (si la sortie s'avère non voulue) :
--   UPDATE "Document" d SET "entityId" = l."chainFromId"
--     FROM "LegalDocument" l WHERE l.id = d."entityId" AND l.id LIKE 'linv\_%' AND l."chainFromId" IS NOT NULL;
--   DELETE FROM "LegalDocumentReader" WHERE "documentId" LIKE 'linv\_%';
--   DELETE FROM "LegalDocument" WHERE id LIKE 'linv\_%';

-- ── 1. UNE PIÈCE LEGAL PAR FACTURE TROUVÉE DANS UN BON DE COMMANDE ────────────────────────────
INSERT INTO "LegalDocument" (
  "id", "companyId", "title", "kind", "status", "folderId", "chainFromId",
  "notes", "createdById", "createdAt", "updatedAt"
)
SELECT
  'linv_' || d."id",
  bc."companyId",
  -- Le nom du fichier, sans son extension. C'est la seule information réelle dont on dispose ;
  -- un titre inventé serait plus propre à l'œil et faux.
  COALESCE(
    NULLIF(regexp_replace(d."name", '\.[A-Za-z0-9]{1,5}$', ''), ''),
    'Facture — ' || bc."title"
  ),
  'INVOICE'::"LegalDocKind",
  'ACTIVE'::"LegalDocStatus",
  bc."folderId",
  bc."id",
  'Sortie du bon de commande « '
    || COALESCE(NULLIF(bc."reference", ''), bc."title")
    || CASE WHEN bc."counterparty" IS NOT NULL AND bc."counterparty" <> ''
            THEN ' » (contrepartie du bon : ' || bc."counterparty" || ')'
            ELSE ' »' END
    || '. À compléter : référence, montant, dates, contrepartie.',
  d."uploadedById",
  d."createdAt",
  NOW()
FROM "Document" d
JOIN "LegalDocument" bc ON bc."id" = d."entityId"
WHERE d."entityType" = 'LEGAL_DOCUMENT'
  AND d."category" = 'INVOICE'
  AND bc."kind" = 'PURCHASE_ORDER'
  AND NOT EXISTS (SELECT 1 FROM "LegalDocument" x WHERE x."id" = 'linv_' || d."id");

-- ── 2. LES LECTEURS DU BON DEVIENNENT LES LECTEURS DE LA FACTURE ──────────────────────────────
-- Liste vide = document ouvert à tout le module. Ne pas recopier aurait donc élargi l'accès.
INSERT INTO "LegalDocumentReader" ("id", "documentId", "userId", "grantedById", "createdAt")
SELECT
  'linvr_' || d."id" || '_' || r."id",
  'linv_' || d."id",
  r."userId",
  r."grantedById",
  NOW()
FROM "Document" d
JOIN "LegalDocument" bc ON bc."id" = d."entityId"
JOIN "LegalDocumentReader" r ON r."documentId" = bc."id"
WHERE d."entityType" = 'LEGAL_DOCUMENT'
  AND d."category" = 'INVOICE'
  AND bc."kind" = 'PURCHASE_ORDER'
  AND EXISTS (SELECT 1 FROM "LegalDocument" x WHERE x."id" = 'linv_' || d."id")
  AND NOT EXISTS (
    SELECT 1 FROM "LegalDocumentReader" e
    WHERE e."documentId" = 'linv_' || d."id" AND e."userId" = r."userId"
  );

-- ── 3. LE JOURNAL, AVANT QUE LA PIÈCE NE BOUGE ────────────────────────────────────────────────
-- Une pièce qui change de dossier sans trace est une pièce qu'on croira perdue. L'entrée est
-- écrite SANS acteur : c'est une opération de reprise, pas le geste de quelqu'un.
INSERT INTO "AuditLog" ("id", "actorId", "action", "module", "entityType", "entityId", "summary", "createdAt")
SELECT
  'alinv_' || d."id",
  NULL,
  'CREATE'::"AuditAction",
  'Legal',
  'LEGAL_DOCUMENT'::"EntityType",
  'linv_' || d."id",
  'Facture sortie du bon de commande « ' || COALESCE(NULLIF(bc."reference", ''), bc."title")
    || ' » et érigée en pièce Legal (reprise automatique) — à compléter.',
  NOW()
FROM "Document" d
JOIN "LegalDocument" bc ON bc."id" = d."entityId"
WHERE d."entityType" = 'LEGAL_DOCUMENT'
  AND d."category" = 'INVOICE'
  AND bc."kind" = 'PURCHASE_ORDER'
  AND EXISTS (SELECT 1 FROM "LegalDocument" x WHERE x."id" = 'linv_' || d."id")
  AND NOT EXISTS (SELECT 1 FROM "AuditLog" a WHERE a."id" = 'alinv_' || d."id");

-- ── 4. LE FICHIER DÉMÉNAGE — il n'est pas recopié ─────────────────────────────────────────────
-- En DERNIER : les trois étapes précédentes lisent le rattachement d'origine.
UPDATE "Document" d
SET "entityId" = 'linv_' || d."id"
FROM "LegalDocument" bc
WHERE bc."id" = d."entityId"
  AND d."entityType" = 'LEGAL_DOCUMENT'
  AND d."category" = 'INVOICE'
  AND bc."kind" = 'PURCHASE_ORDER'
  AND EXISTS (SELECT 1 FROM "LegalDocument" x WHERE x."id" = 'linv_' || d."id");
