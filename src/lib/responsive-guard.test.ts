import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * LE GARDE-FOU DU RESPONSIVE — deux erreurs qui reviennent, et qu'on ne voit pas en développant.
 *
 * On travaille sur un écran large ; les deux défauts ci-dessous n'y apparaissent jamais. Ils ne se
 * découvrent que sur le téléphone de quelqu'un, en réunion, et ils donnent exactement la sensation
 * dont on se plaint : « il faut tirer l'écran vers la gauche ».
 *
 *  1. UNE TABLE LARGE HORS CONTENEUR DÉFILANT. Une table qui impose sa largeur minimale sans être
 *     enveloppée dans un `overflow-x-auto` ne défile pas toute seule : c'est LA PAGE ENTIÈRE qui
 *     part de travers, en-tête et menu compris.
 *  2. `col-span-N` SANS PRÉFIXE, dans une grille qui commence à UNE colonne. CSS grid crée alors
 *     une deuxième colonne implicite : l'élément « pleine largeur » devient deux fois trop large
 *     et pousse tout le reste hors de l'écran. Le correctif est toujours le même — `sm:col-span-N`.
 *
 * Ce test lit les sources : il n'a besoin ni de navigateur, ni de capture d'écran.
 */

const ROOTS = ["src/app", "src/components"];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => tsxFiles(r));

/** Le numéro de ligne d'une position dans un fichier — pour que l'échec soit actionnable. */
const lineAt = (source: string, index: number) => source.slice(0, index).split("\n").length;

/**
 * Les COMMENTAIRES ne sont pas du balisage.
 *
 * Un commentaire qui EXPLIQUE le piège (« ici, `col-span-2` fabriquerait une colonne implicite »)
 * déclencherait l'alerte qu'il sert à prévenir — et l'on apprendrait à contourner le garde-fou en
 * s'interdisant d'écrire des commentaires clairs. On les blanchit, en gardant les sauts de ligne
 * pour que les numéros restent justes.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

describe("responsive — la page ne doit JAMAIS défiler latéralement", () => {
  it("toute table à largeur minimale défile DANS SON PROPRE conteneur", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = withoutComments(readFileSync(file, "utf8"));
      for (const m of source.matchAll(/<table[^>]*min-w-\[/g)) {
        // Le conteneur défilant est juste au-dessus dans le balisage : on regarde ce qui précède
        // immédiatement l'ouverture de la table.
        const before = source.slice(Math.max(0, m.index - 400), m.index);
        if (!/overflow-x-auto|overflow-auto/.test(before)) {
          offenders.push(`${file}:${lineAt(source, m.index)}`);
        }
      }
    }
    expect(offenders, `Table large sans conteneur défilant (ajouter un parent « overflow-x-auto ») :\n${offenders.join("\n")}`)
      .toEqual([]);
  });

  it("aucun `col-span-N` non préfixé ne cohabite avec une grille à une seule colonne", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = withoutComments(readFileSync(file, "utf8"));
      // Le fichier déclare-t-il une grille qui DÉMARRE à une colonne ?
      if (!/grid-cols-1\b/.test(source)) continue;
      for (const m of source.matchAll(/(?<![a-z0-9:-])col-span-\d/g)) {
        const start = source.lastIndexOf('"', m.index) + 1;
        const prefixChar = source.slice(Math.max(start, m.index - 3), m.index);
        // `sm:`/`md:`/`lg:`/`xl:col-span-N` sont corrects : ils ne s'appliquent qu'une fois la
        // grille passée à plusieurs colonnes.
        if (/(sm|md|lg|xl):$/.test(prefixChar)) continue;
        offenders.push(`${file}:${lineAt(source, m.index)}`);
      }
    }
    expect(offenders, `« col-span » non préfixé dans un fichier à grille mono-colonne (utiliser « sm:col-span-N ») :\n${offenders.join("\n")}`)
      .toEqual([]);
  });
});
