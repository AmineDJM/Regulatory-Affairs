import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { defaultDefinition } from "./defaults";
import { parcoursAdPro, etapesNonAtteintes, SLUG_DIRECTION } from "./parcours";
import { argentEffectif } from "./pouvoirs-argent";
import { WORKFLOW_CATEGORIES } from "./types";

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LA DESCRIPTION DE L'ÉTAPE « final » DIT CE QUE L'ÉTAPE FAIT — sur les deux routes.
 *
 * Elle affirmait « le montant et la sous-catégorie budgétaire ne se décident PAS ici ». Depuis
 * §118.197g, sur la route d'une demande de rang 2 (Direction Marketing, Manager Promotion
 * médicale), l'étape CONCLUT et hérite des pouvoirs d'argent des étapes qu'elle n'atteint pas.
 * La phrase que lit le Super Admin contredisait le moteur.
 *
 * Trois propriétés : la graine et la migration portent le MÊME texte (deux sources de la même
 * étape feraient deux circuits sous un seul nom, §118.5) ; ce que le texte annonce, le moteur le
 * fait (on le lit dans `argentEffectif`, pas dans la prose) ; la migration, jouée sur son TEXTE
 * RÉEL contre une table temporaire, ne remplace que l'ancien texte mot pour mot — une description
 * qu'un Super Admin a réécrite est une décision.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

const SQL = readFileSync(
  path.join(process.cwd(), "prisma/migrations/20270104091000_description_etape_final/migration.sql"), "utf8",
);
const ANCIEN = "La Direction donne son accord sur l'opération. Le montant et la sous-catégorie budgétaire ne se "
  + "décident PAS ici : ils appartiennent à Direction Marketing, qui tranche ensuite.";

/** Le littéral SQL qui suit `SET "description" =`, apostrophes doublées rendues simples. */
function texteDeLaMigration(): string {
  const m = /SET "description" = '((?:[^']|'')*)'/.exec(SQL);
  if (!m) throw new Error("la migration ne pose aucune description");
  return m[1].replace(/''/g, "'");
}

const descriptionFinale = (categorie: (typeof WORKFLOW_CATEGORIES)[number]) =>
  defaultDefinition(categorie).steps.find((s) => s.slug === SLUG_DIRECTION)?.description ?? "";

describe("La description de l'étape « final » — la graine, la migration, le moteur", () => {
  it("la graine et la migration portent le MÊME texte, pour les quatre circuits", () => {
    const migration = texteDeLaMigration();
    for (const c of WORKFLOW_CATEGORIES) expect(descriptionFinale(c), c).toBe(migration);
  });

  it("l'ancienne phrase a quitté la graine, et la migration ne remplace qu'elle, mot pour mot", () => {
    for (const c of WORKFLOW_CATEGORIES) expect(descriptionFinale(c), c).not.toContain("ne se décident PAS ici");
    expect(SQL).toContain(`AND "description" = '${ANCIEN.replace(/'/g, "''")}'`);
    expect(SQL).toMatch(/WHERE "slug" = 'final'/);
  });

  it("ce que la phrase annonce, le moteur le fait : la route du rang 2 conclut à « final » et y décide l'argent", () => {
    const texte = descriptionFinale("EVENTS");
    expect(texte).toMatch(/Manager Promotion médicale/);
    expect(texte).toMatch(/conclut/);
    for (const c of WORKFLOW_CATEGORIES) {
      const etapes = defaultDefinition(c).steps;
      const p = parcoursAdPro({ rang: 2, kam: false, categorie: c });
      expect(p.decision, c).toBe(SLUG_DIRECTION);
      const non = new Set(etapesNonAtteintes(etapes.map((s) => s.slug), p.decision, p.ignorees));
      const cfg = (s: (typeof etapes)[number]) => ({ powers: s.powers, requireAmount: !!s.requireAmount, requireCategory: !!s.requireCategory });
      const finale = etapes.find((s) => s.slug === SLUG_DIRECTION)!;
      const effective = argentEffectif(cfg(finale), true, etapes.filter((s) => non.has(s.slug)).map(cfg));
      // « montant accordé et sous-catégorie budgétaire compris QUAND LE CIRCUIT LES EXIGE » : le
      // sponsoring pré-valide la TENUE et ne fixe aucun argent à cette étape (§118.151).
      expect(effective.requireAmount, c).toBe(c !== "SPONSORING");
      expect(effective.requireCategory, c).toBe(c !== "SPONSORING");
    }
  });
});

let dbOk = false;
try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch { dbOk = false; }
const suite = dbOk ? describe : describe.skip;

/** Joue le SQL du FICHIER `passes` fois sur une table temporaire préparée par `lignes`. */
async function jouer(lignes: { id: string; slug: string; description: string | null }[], passes: number) {
  const ANNULE = new Error("annulé — le banc ne garde rien");
  let apres: { id: string; description: string | null }[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      // `pg_temp` passe devant `public` pour la session : le SQL s'exécute tel qu'il est écrit,
      // sans lire ni écrire les circuits réels de la base partagée (§118.173).
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE "WorkflowStep" ("id" text PRIMARY KEY, "slug" text NOT NULL, "description" text) ON COMMIT DROP`);
      for (const l of lignes) {
        await tx.$executeRawUnsafe(`INSERT INTO "WorkflowStep" (id, slug, description) VALUES ($1, $2, $3)`, l.id, l.slug, l.description);
      }
      for (let i = 0; i < passes; i++) await tx.$executeRawUnsafe(SQL);
      apres = await tx.$queryRawUnsafe(`SELECT id, description FROM "WorkflowStep" ORDER BY id`);
      throw ANNULE;
    }, { timeout: 20_000 });
  } catch (e) {
    if (e !== ANNULE) throw e;
  }
  return new Map(apres.map((l) => [l.id, l.description]));
}

suite("La migration, jouée sur son texte réel", () => {
  const PERSO = "Validation de la Direction des opérations — réglée par le Super Admin, avec sa propre phrase.";
  const lignes = [
    { id: "a-ancien", slug: "final", description: ANCIEN },
    { id: "b-perso", slug: "final", description: PERSO },
    { id: "c-autre-etape", slug: "marketing", description: ANCIEN },
    { id: "d-vide", slug: "final", description: null },
  ];

  it("l'ancien texte devient celui de la graine ; une phrase réécrite, une autre étape et un vide ne bougent pas", async () => {
    const apres = await jouer(lignes, 1);
    expect(apres.get("a-ancien")).toBe(descriptionFinale("CONGRESS_NATIONAL"));
    expect(apres.get("b-perso")).toBe(PERSO);
    expect(apres.get("c-autre-etape")).toBe(ANCIEN);
    expect(apres.get("d-vide")).toBeNull();
  });

  it("rejouée, elle ne change RIEN de plus — deux passes identiques", async () => {
    const une = await jouer(lignes, 1);
    const deux = await jouer(lignes, 2);
    expect([...deux]).toEqual([...une]);
  });
});
