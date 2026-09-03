-- ════════════════════════════════════════════════════════════════════════════════════════════
-- LA BUSINESS UNIT DEVIENT UN SOUS-DÉPARTEMENT, ET LES DEMANDES Ad&Pro LUI SONT RATTACHÉES.
--
-- ── POURQUOI UN DÉPARTEMENT, ET NON DES COLONNES DE BUDGET ──────────────────────────────────
--
-- Une BU a un budget Ad&Pro et une masse salariale. Ce sont exactement les deux choses qu'un
-- DÉPARTEMENT porte déjà : ses enveloppes, ses dépenses, ses demandes de budget, sa caisse
-- d'avance, ses salariés, ses droits d'accès et son arbre. Lui donner ses propres colonnes aurait
-- créé un second mécanisme à côté de celui qui marche — et deux réponses à « combien la gamme
-- a-t-elle dépensé ? », dont personne n'aurait su laquelle croire (§17 : pas de second registre).
--
-- ── POURQUOI LE RATTACHEMENT DES DEMANDES Ad&Pro ────────────────────────────────────────────
--
-- Une prise en charge, un congrès, un matériel promotionnel engagent l'argent d'UNE gamme. Sans
-- ce lien, la dépense pesait sur un total commercial que personne ne pouvait répartir : le budget
-- consolidé existait, le budget PAR BU n'existait pas.
--
-- AUCUNE REPRISE : ni le département des BU existantes, ni la BU des demandes déjà déposées. On
-- ne DEVINE pas quelle gamme portait une prise en charge de l'an dernier — un rattachement faux
-- est pire qu'un rattachement absent, parce qu'il se compte dans un budget.
-- ════════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE "BusinessUnit" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;

DO $$
BEGIN
  ALTER TABLE "BusinessUnit"
    ADD CONSTRAINT "BusinessUnit_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "BusinessUnit_departmentId_idx" ON "BusinessUnit"("departmentId");

-- Les cinq portes d'entrée d'une demande Ad&Pro.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['SponsoringRequest', 'CongressNational', 'CongressInternational', 'Event', 'PromoMaterial']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "businessUnitId" TEXT', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("businessUnitId")', t || '_businessUnitId_idx', t);
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("businessUnitId") REFERENCES "BusinessUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE',
        t, t || '_businessUnitId_fkey');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
