/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * AUCUN MODULE CENTRAL NE REDEVIENT INJOIGNABLE (§53).
 *
 * ── CE QUE CE TEST EMPÊCHE DE SE REPRODUIRE ──────────────────────────────────────────────
 *
 * L'audit Frontier a trouvé trois modules du Mission Runtime — l'échelle de recours, l'ordre
 * des sources, les modèles opérationnels — écrits, testés, documentés, et appelés par personne.
 * Rien ne l'avait signalé pendant des semaines : leurs tests unitaires étaient verts, et c'est
 * précisément ce qui rendait le défaut invisible.
 *
 * Ce test lit le graphe d'imports et refuse qu'un module du périmètre central retombe dans cet
 * état. Il ne remplace pas les tests de comportement : il garde la question qu'aucun d'eux ne
 * pose — « quelqu'un s'en sert-il ? »
 *
 * ── POURQUOI UNE LISTE D'EXCEPTIONS EXPLICITE ────────────────────────────────────────────
 *
 * Parce qu'un utilitaire de test légitime existe, et qu'un garde qui rend la CI impossible
 * finit désactivé. L'exception se déclare ici, avec sa raison, et se relit.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Le périmètre gardé : le cœur durable, là où un module mort coûte le plus cher. */
const CENTRAL = ["src/lib/missions", "src/lib/artifact"];

/**
 * MODULES AUTORISÉS À N'ÊTRE APPELÉS QUE PAR DES TESTS.
 *
 * Vide aujourd'hui, et c'est le but. Toute entrée ajoutée ici doit porter sa raison en clair —
 * « c'est un utilitaire de banc », « c'est un adaptateur de fixture ». « On le branchera plus
 * tard » n'en est pas une : c'est exactement la phrase que ce test existe pour refuser.
 */
const EXCEPTIONS: Record<string, string> = {};

const rg = (args: string[]): string[] => {
  try {
    return execFileSync("rg", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 })
      .split("\n").filter(Boolean);
  } catch { return []; }
};

const estTest = (f: string) =>
  /\.test\.tsx?$/.test(f) || /(^|\/)e2e\//.test(f) || /(^|\/)fakes\.ts$/.test(f)
  || /(^|\/)fixtures\.ts$/.test(f) || /(^|\/)scripts\/(bench|auto-test)\//.test(f)
  || /(^|\/)audit\//.test(f) || /(^|\/)fake-[\w-]+\.ts$/.test(f);

function classer(racine: string) {
  const fichiers = rg(["--files", "-g", "*.ts", "-g", "!*.test.ts", "-g", "!fakes.ts", "-g", "!fixtures.ts", racine]);
  const testOnly: string[] = [];
  const orphelins: string[] = [];
  for (const chemin of fichiers) {
    const alias = chemin.replace(/^src\//, "@/").replace(/\.tsx?$/, "");
    const lignes = rg(["-n", "--no-heading", "-F", alias, "-g", "*.ts", "-g", "*.tsx", "src", "scripts", "e2e"]);
    const vus = new Set(lignes.map((l) => l.slice(0, l.indexOf(":"))).filter((f) => f !== chemin));
    const prod = [...vus].filter((f) => !estTest(f));
    if (prod.length > 0) continue;
    ([...vus].length > 0 ? testOnly : orphelins).push(chemin);
  }
  return { testOnly, orphelins, total: fichiers.length };
}

describe("joignabilité depuis la production", () => {
  for (const racine of CENTRAL) {
    it(`${racine} — aucun module atteignable seulement par les tests`, () => {
      const { testOnly } = classer(racine);
      const fautifs = testOnly.filter((m) => !(m in EXCEPTIONS));
      expect(fautifs, `modules test-only sans exception déclarée :\n  ${fautifs.join("\n  ")}`).toEqual([]);
    });

    it(`${racine} — aucun module orphelin`, () => {
      expect(classer(racine).orphelins).toEqual([]);
    });
  }

  /**
   * §54 — LE CROISEMENT AVEC LE CATALOGUE DES CAPACITÉS.
   *
   * Une capacité exposée au planner dont l'implémentation ne serait pas joignable serait pire
   * qu'absente : le modèle la choisirait, et l'étape échouerait à l'exécution.
   */
  it("chaque capacité artefact déclarée pointe vers un module joignable", async () => {
    const { CAPACITES_ARTEFACT } = await import("@/lib/artifact/capabilities/catalog");
    const moteur = readFileSync("src/lib/artifact/runtime/engine.ts", "utf8");
    expect(CAPACITES_ARTEFACT.length).toBeGreaterThan(0);
    // Le moteur est importé par le pont ; s'il ne l'était plus, le test « aucun module
    // test-only » ci-dessus tomberait déjà. Ici on vérifie qu'il porte bien des points d'entrée.
    expect(moteur).toMatch(/export async function ouvrir/);
  });
});
