-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- DEMANDES DE STOCKS — le DO choisit établissements × produits, chaque KAM renseigne les siens
-- (Direction, 06/10).
--
-- IDEMPOTENTE, comme toute migration de ce dépôt : `IF NOT EXISTS` partout, contraintes posées
-- sous `DO $$ … duplicate_object`.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "StockCountRequest" (
  "id"           TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "dueDate"      TIMESTAMP(3),
  "notes"        TEXT,
  "status"       TEXT NOT NULL DEFAULT 'OUVERTE',
  "toutHopitaux" BOOLEAN NOT NULL DEFAULT false,
  "createdById"  TEXT,
  "closedAt"     TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockCountRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockCountRequestHospital" (
  "id"            TEXT NOT NULL,
  "requestId"     TEXT NOT NULL,
  "institutionId" TEXT,
  "name"          TEXT NOT NULL,
  "wilaya"        TEXT,
  "tousProduits"  BOOLEAN NOT NULL DEFAULT false,
  "sansKam"       BOOLEAN NOT NULL DEFAULT false,
  "note"          TEXT,
  "noteById"      TEXT,
  CONSTRAINT "StockCountRequestHospital_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockCountRequestLine" (
  "id"           TEXT NOT NULL,
  "requestId"    TEXT NOT NULL,
  "hospitalId"   TEXT NOT NULL,
  "productId"    TEXT,
  "productLabel" TEXT NOT NULL,
  "kamIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "quantity"     INTEGER,
  "rupture"      BOOLEAN NOT NULL DEFAULT false,
  "savedAt"      TIMESTAMP(3),
  "savedById"    TEXT,
  "snapshotId"   TEXT,
  CONSTRAINT "StockCountRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StockCountRequestRecipient" (
  "id"          TEXT NOT NULL,
  "requestId"   TEXT NOT NULL,
  "kamId"       TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "remindedAt"  TIMESTAMP(3),
  "remindCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockCountRequestRecipient_pkey" PRIMARY KEY ("id")
);

-- LES INDEX — dont les deux unicités qui tiennent la matrice : un établissement une fois par
-- demande, un produit une fois par établissement.
CREATE INDEX IF NOT EXISTS "StockCountRequest_status_createdAt_idx" ON "StockCountRequest" ("status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StockCountRequestHospital_requestId_institutionId_key" ON "StockCountRequestHospital" ("requestId", "institutionId");
CREATE INDEX IF NOT EXISTS "StockCountRequestHospital_institutionId_idx" ON "StockCountRequestHospital" ("institutionId");
CREATE UNIQUE INDEX IF NOT EXISTS "StockCountRequestLine_hospitalId_productId_key" ON "StockCountRequestLine" ("hospitalId", "productId");
CREATE INDEX IF NOT EXISTS "StockCountRequestLine_requestId_idx" ON "StockCountRequestLine" ("requestId");
CREATE INDEX IF NOT EXISTS "StockCountRequestLine_productId_idx" ON "StockCountRequestLine" ("productId");
CREATE INDEX IF NOT EXISTS "StockCountRequestLine_snapshotId_idx" ON "StockCountRequestLine" ("snapshotId");
CREATE UNIQUE INDEX IF NOT EXISTS "StockCountRequestRecipient_requestId_kamId_key" ON "StockCountRequestRecipient" ("requestId", "kamId");
CREATE INDEX IF NOT EXISTS "StockCountRequestRecipient_kamId_submittedAt_idx" ON "StockCountRequestRecipient" ("kamId", "submittedAt");

-- LES CLÉS ÉTRANGÈRES :
--   · la demande emporte ses établissements, ses lignes, ses destinataires (CASCADE) ;
--   · l'auteur, l'établissement, le produit et l'état daté en SET NULL — la demande passée reste
--     lisible (noms figés), et un état de stock ne disparaît pas avec la demande qui l'a produit ;
--   · le KAM destinataire en CASCADE — une demande adressée à un compte supprimé n'attend personne.
DO $$ BEGIN
  ALTER TABLE "StockCountRequest" ADD CONSTRAINT "StockCountRequest_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestHospital" ADD CONSTRAINT "StockCountRequestHospital_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "StockCountRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestHospital" ADD CONSTRAINT "StockCountRequestHospital_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "MedicalInstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestLine" ADD CONSTRAINT "StockCountRequestLine_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "StockCountRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestLine" ADD CONSTRAINT "StockCountRequestLine_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "StockCountRequestHospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestLine" ADD CONSTRAINT "StockCountRequestLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "RegulatoryProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestLine" ADD CONSTRAINT "StockCountRequestLine_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "StockSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestRecipient" ADD CONSTRAINT "StockCountRequestRecipient_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "StockCountRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StockCountRequestRecipient" ADD CONSTRAINT "StockCountRequestRecipient_kamId_fkey"
    FOREIGN KEY ("kamId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
