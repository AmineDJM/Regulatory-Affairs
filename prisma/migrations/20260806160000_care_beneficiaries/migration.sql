-- PRISE EN CHARGE : personnes, cases, devis.
--
-- Les « personnes prises en charge » étaient un tableau JSON : impossible d'y porter un avis,
-- une décision par personne, ou la liste de ce qu'il faut fournir et acheter pour chacune.
-- Elles deviennent une vraie table, avec leurs cases et les devis qui les couvrent.
--
-- Additive et idempotente. Le JSON existant est repris en fin de fichier, sans être détruit.

DO $$ BEGIN CREATE TYPE "CareOpinion" AS ENUM ('FAVORABLE','UNFAVORABLE','NONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CareBeneficiaryStatus" AS ENUM ('PROPOSED','APPROVED','REJECTED','WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CareCellKind" AS ENUM ('DOCUMENT','SERVICE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CareServiceKind" AS ENUM ('HOTEL','TRANSPORT','TICKET','CATERING','REGISTRATION','VISA_FEE','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CareCellStatus" AS ENUM ('REQUESTED','PROVIDED','SETTLED','WAIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CareQuoteStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Un événement « national » peut se tenir hors d'Algérie : l'écran demande pays + ville dans les deux cas.
ALTER TABLE "CongressNational" ADD COLUMN IF NOT EXISTS "country" TEXT;

CREATE TABLE IF NOT EXISTS "CareBeneficiary" (
  "id"                      TEXT NOT NULL,
  "congressNationalId"      TEXT,
  "congressInternationalId" TEXT,
  "doctorId"                TEXT,
  "firstName"               TEXT,
  "lastName"                TEXT,
  "jobTitle"                TEXT,
  "institution"             TEXT,
  "requesterOpinion"        "CareOpinion" NOT NULL DEFAULT 'NONE',
  "requesterNote"           TEXT,
  "status"                  "CareBeneficiaryStatus" NOT NULL DEFAULT 'PROPOSED',
  "decidedById"             TEXT,
  "decidedAt"               TIMESTAMP(3),
  "decisionNote"            TEXT,
  "position"                INTEGER NOT NULL DEFAULT 0,
  "createdById"             TEXT,
  "updatedById"             TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareBeneficiary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CareCell" (
  "id"             TEXT NOT NULL,
  "beneficiaryId"  TEXT NOT NULL,
  "kind"           "CareCellKind" NOT NULL,
  "serviceKind"    "CareServiceKind",
  "label"          TEXT NOT NULL,
  "notes"          TEXT,
  "status"         "CareCellStatus" NOT NULL DEFAULT 'REQUESTED',
  "documentId"     TEXT,
  "quoteId"        TEXT,
  "amountDzd"      DECIMAL(14,2),
  "expenseOrderId" TEXT,
  "requestedById"  TEXT,
  "position"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareCell_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CareQuote" (
  "id"                      TEXT NOT NULL,
  "congressNationalId"      TEXT,
  "congressInternationalId" TEXT,
  "supplier"                TEXT NOT NULL,
  "reference"               TEXT,
  "amountDzd"               DECIMAL(14,2) NOT NULL,
  "status"                  "CareQuoteStatus" NOT NULL DEFAULT 'PENDING',
  "documentId"              TEXT,
  "note"                    TEXT,
  "decidedById"             TEXT,
  "decidedAt"               TIMESTAMP(3),
  "expenseOrderId"          TEXT,
  "createdById"             TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CareQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CareQuoteCell" (
  "quoteId" TEXT NOT NULL,
  "cellId"  TEXT NOT NULL,
  CONSTRAINT "CareQuoteCell_pkey" PRIMARY KEY ("quoteId","cellId")
);

CREATE INDEX IF NOT EXISTS "CareBeneficiary_congressNationalId_idx" ON "CareBeneficiary"("congressNationalId");
CREATE INDEX IF NOT EXISTS "CareBeneficiary_congressInternationalId_idx" ON "CareBeneficiary"("congressInternationalId");
CREATE INDEX IF NOT EXISTS "CareBeneficiary_doctorId_idx" ON "CareBeneficiary"("doctorId");
CREATE INDEX IF NOT EXISTS "CareCell_beneficiaryId_idx" ON "CareCell"("beneficiaryId");
CREATE INDEX IF NOT EXISTS "CareCell_quoteId_idx" ON "CareCell"("quoteId");
CREATE INDEX IF NOT EXISTS "CareQuote_congressNationalId_idx" ON "CareQuote"("congressNationalId");
CREATE INDEX IF NOT EXISTS "CareQuote_congressInternationalId_idx" ON "CareQuote"("congressInternationalId");
CREATE INDEX IF NOT EXISTS "CareQuote_status_idx" ON "CareQuote"("status");
CREATE INDEX IF NOT EXISTS "CareQuoteCell_cellId_idx" ON "CareQuoteCell"("cellId");

-- Cascades : supprimer la demande supprime ses personnes, leurs cases et ses devis.
DO $$ BEGIN ALTER TABLE "CareBeneficiary" ADD CONSTRAINT "CareBeneficiary_congressNationalId_fkey" FOREIGN KEY ("congressNationalId") REFERENCES "CongressNational"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CareBeneficiary" ADD CONSTRAINT "CareBeneficiary_congressInternationalId_fkey" FOREIGN KEY ("congressInternationalId") REFERENCES "CongressInternational"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CareCell" ADD CONSTRAINT "CareCell_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "CareBeneficiary"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CareQuote" ADD CONSTRAINT "CareQuote_congressNationalId_fkey" FOREIGN KEY ("congressNationalId") REFERENCES "CongressNational"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CareQuote" ADD CONSTRAINT "CareQuote_congressInternationalId_fkey" FOREIGN KEY ("congressInternationalId") REFERENCES "CongressInternational"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CareQuoteCell" ADD CONSTRAINT "CareQuoteCell_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CareQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CareQuoteCell" ADD CONSTRAINT "CareQuoteCell_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "CareCell"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EXACTEMENT un parent, sinon la personne serait invisible partout tout en existant.
DO $$ BEGIN ALTER TABLE "CareBeneficiary" ADD CONSTRAINT "CareBeneficiary_one_parent" CHECK (("congressNationalId" IS NOT NULL)::int + ("congressInternationalId" IS NOT NULL)::int = 1); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CareQuote" ADD CONSTRAINT "CareQuote_one_parent" CHECK (("congressNationalId" IS NOT NULL)::int + ("congressInternationalId" IS NOT NULL)::int = 1); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Une case SERVICE porte une nature, une case DOCUMENT n'en porte pas : sans cette garde on
-- se retrouverait avec des « documents hôtel » impossibles à traiter.
DO $$ BEGIN ALTER TABLE "CareCell" ADD CONSTRAINT "CareCell_service_kind" CHECK (("kind" = 'SERVICE' AND "serviceKind" IS NOT NULL) OR ("kind" = 'DOCUMENT' AND "serviceKind" IS NULL)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────── Reprise du JSON existant ───────────────
-- Les personnes déjà saisies deviennent des lignes. Le JSON d'origine n'est PAS effacé : en cas
-- de doute sur la reprise, la source reste lisible. `ON CONFLICT DO NOTHING` rend l'opération
-- rejouable — un identifiant déjà repris n'est pas dupliqué.
INSERT INTO "CareBeneficiary" ("id","congressNationalId","lastName","jobTitle","institution","position","createdAt","updatedAt")
SELECT
  'mig_' || c."id" || '_' || (b."ordinality")::text,
  c."id",
  NULLIF(b."value"->>'name',''),
  NULLIF(b."value"->>'role',''),
  NULLIF(b."value"->>'institution',''),
  (b."ordinality")::int,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CongressNational" c,
     LATERAL jsonb_array_elements(c."beneficiaries"::jsonb) WITH ORDINALITY AS b("value","ordinality")
WHERE c."beneficiaries" IS NOT NULL
  AND jsonb_typeof(c."beneficiaries"::jsonb) = 'array'
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CareBeneficiary" ("id","congressInternationalId","lastName","jobTitle","institution","position","createdAt","updatedAt")
SELECT
  'mig_' || c."id" || '_' || (b."ordinality")::text,
  c."id",
  NULLIF(b."value"->>'name',''),
  NULLIF(b."value"->>'role',''),
  NULLIF(b."value"->>'institution',''),
  (b."ordinality")::int,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CongressInternational" c,
     LATERAL jsonb_array_elements(c."beneficiaries"::jsonb) WITH ORDINALITY AS b("value","ordinality")
WHERE c."beneficiaries" IS NOT NULL
  AND jsonb_typeof(c."beneficiaries"::jsonb) = 'array'
ON CONFLICT ("id") DO NOTHING;
