import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Icon, iconeParNom } from "./icon";

/**
 * TOUT NOM D'ICÔNE PASSÉ EN CHAÎNE RÉSOUT (§118.149).
 *
 * `Icon` rend `null` sur un nom qu'il ne connaît pas — sans erreur, sans avertissement : une
 * carte d'indicateur sans icône ne se voit qu'en la regardant. Mesuré avant ce cliquet : sept
 * noms du dépôt ne résolvaient rien (dont `FileSignature`, que je venais d'écrire). Le cliquet
 * lit la SOURCE — les formes `icon="X"`, `icon: "X"`, `iconName="X"` — et exige que chaque nom
 * trouvé résolve par le MÊME résolveur que l'écran. Il porte un PLANCHER de noms lus : un parcours
 * cassé qui ne trouverait rien serait vert sans rien garder (§118.17).
 */

const RACINE = join(process.cwd(), "src");
const MOTIF = /\b(?:icon|iconName)(?:=|:\s*)["']([A-Z][A-Za-z0-9]+)["']/g;

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) { if (nom !== "node_modules") fichiers(chemin, acc); continue; }
    if (/\.(tsx?|mts)$/.test(nom) && !/\.test\.tsx?$/.test(nom)) acc.push(chemin);
  }
  return acc;
}

describe("les noms d'icônes de la source résolvent", () => {
  const trouves = new Map<string, string>();
  for (const f of fichiers(RACINE)) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(MOTIF)) if (!trouves.has(m[1])) trouves.set(m[1], f.slice(RACINE.length + 1));
  }

  it("PLANCHER : le parcours lit bien les noms du dépôt", () => {
    expect(trouves.size).toBeGreaterThanOrEqual(100);
  });

  it("chaque nom trouvé rend une icône — aucun ne tombe en silence sur `null`", () => {
    const morts = [...trouves].filter(([nom]) => iconeParNom(nom) === null).map(([nom, f]) => `${nom} (${f})`);
    expect(morts, "nom d'icône inconnu de lucide — renommé ? vérifiez la table `icons`").toEqual([]);
  });

  it("l'ancien nom d'une icône renommée résout vers la MÊME icône que le nouveau", () => {
    expect(iconeParNom("AlertTriangle")).toBe(iconeParNom("TriangleAlert"));
    expect(iconeParNom("CheckCircle2")).toBe(iconeParNom("CircleCheck"));
  });

  it("le COMPOSANT passe par le résolveur : l'ancien nom se DESSINE à l'écran", () => {
    // Le point d'appel, pas le corps (§118.49) : un `Icon` qui relirait la table `icons` en
    // direct laisserait le résolveur juste et l'écran vide — le défaut exact qu'on ferme.
    expect(renderToStaticMarkup(React.createElement(Icon, { name: "AlertTriangle" }))).toContain("<svg");
    expect(renderToStaticMarkup(React.createElement(Icon, { name: "PasUneIconeDuTout" }))).toBe("");
  });

  it("un nom inconnu, ou un export qui n'est pas une icône, ne rend rien", () => {
    expect(iconeParNom("PasUneIconeDuTout")).toBeNull();
    expect(iconeParNom("createLucideIcon")).toBeNull();
    expect(iconeParNom("icons")).toBeNull();
  });
});
