import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ═══════════════════════════════════════════════════════════
 * UN FICHIER « use server » N'EXPORTE QUE DES FONCTIONS ASYNCHRONES (§118.133f).
 *
 * Next.js compile chaque export d'un fichier « use server » en action serveur, et refuse tout
 * ce qui n'en est pas une : `export function` synchrone, `export const`, une classe. Le refus
 * n'arrive QU'AU BUILD DE PRODUCTION (« Server actions must be async functions ») — le typecheck
 * ne le voit pas, la suite de tests non plus, et il a fallu six minutes de build propre pour
 * l'apprendre sur un petit lecteur de clé posé « à côté » de l'action qu'il servait.
 *
 * §118.73 énonçait déjà la règle ; rien ne la TENAIT. Ce banc lit le parc entier (144 fichiers
 * mesurés) et s'arme sur un fait du FICHIER (§118.17) : la directive en tête, puis chaque
 * `export`. Un type ou une interface s'efface à la compilation et reste permis. Le remède est
 * toujours le même : la fonction pure descend dans un module sans directive, et l'action
 * l'importe.
 *
 * Le plancher de fichiers lus empêche la garde de passer au vert sur un parcours cassé.
 * ═══════════════════════════════════════════════════════════
 */

const SRC = join(process.cwd(), "src");

function fichiersTs(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) fichiersTs(chemin, acc);
    else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

/** La directive doit OUVRIR le fichier (commentaires exclus) — une prose qui la cite ne compte pas. */
const estUseServer = (src: string): boolean =>
  /^(?:\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))*\s*["']use server["'];/.test(src);

/** Tout `export` qui n'est ni une fonction asynchrone, ni un type, ni une interface. */
const EXPORT_INTERDIT = /^export\s+(?!async\s+function\b)(?!default\s+async\s+function\b)(?!type\b)(?!interface\b)(function|const|let|var|class|default|enum)\b/gm;

describe('« use server » — seules des fonctions asynchrones sortent d\'un fichier d\'actions', () => {
  const serveur = fichiersTs(SRC).filter((f) => estUseServer(readFileSync(f, "utf8")));

  it("la garde lit bien le parc (plancher de fichiers « use server »)", () => {
    expect(serveur.length).toBeGreaterThanOrEqual(100);
  });

  it("aucun export synchrone, constante, classe ou valeur par défaut non asynchrone", () => {
    const infractions: string[] = [];
    for (const f of serveur) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(EXPORT_INTERDIT)) {
        const ligne = src.slice(0, m.index).split("\n").length;
        infractions.push(`${relative(process.cwd(), f)}:${ligne}: ${src.slice(m.index, (m.index ?? 0) + 80).split("\n")[0]}`);
      }
    }
    expect(
      infractions,
      "Un fichier « use server » ne peut exporter que des fonctions asynchrones (et des types) : le build de " +
        "production refuse le reste. Descendre la fonction pure dans un module sans directive et l'importer.\n" +
        infractions.join("\n"),
    ).toEqual([]);
  });
});
