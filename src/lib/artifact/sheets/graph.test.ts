import { describe, expect, it } from "vitest";
import { construireGraphe, dependantsDirects, idDe, libelleCellule, precedentsDirects, rayonImpact } from "@/lib/artifact/sheets/graph";
import { nouvelleFeuille, poserCellule, type Classeur } from "@/lib/artifact/sheets/model";

/** Un petit classeur écrit à la main : Ventes (B = qté, C = PU, D = total, D6 = somme) et Synthèse. */
function classeur(): Classeur {
  const ventes = nouvelleFeuille(1, "Ventes");
  for (let r = 2; r <= 5; r++) {
    poserCellule(ventes, { row: r, col: 2, v: r, t: "n", f: null });
    poserCellule(ventes, { row: r, col: 3, v: 10, t: "n", f: null });
    poserCellule(ventes, { row: r, col: 4, v: r * 10, t: "n", f: `B${r}*C${r}` });
  }
  poserCellule(ventes, { row: 6, col: 4, v: 140, t: "n", f: "SUM(D2:D5)" });
  poserCellule(ventes, { row: 7, col: 4, v: 26.6, t: "n", f: "D6*TauxTVA" });
  const synth = nouvelleFeuille(2, "Synthèse");
  poserCellule(synth, { row: 1, col: 2, v: 140, t: "n", f: "Ventes!D6" });
  poserCellule(synth, { row: 2, col: 2, v: 0, t: "n", f: "Inconnue!A1+B1" });
  const param = nouvelleFeuille(3, "Param");
  poserCellule(param, { row: 1, col: 2, v: 0.19, t: "n", f: null });
  return { feuilles: [ventes, synth, param], noms: [{ nom: "TauxTVA", refersTo: "Param!$B$1", feuille: null }], limites: [] };
}

describe("le graphe de dépendances", () => {
  it("relie cellules et plages, résout les noms définis, ordonne le calcul et compte", () => {
    const g = construireGraphe(classeur());
    expect(g.metriques.formules).toBe(8);
    expect(g.cycles).toEqual([]);
    // D2 dépend de B2 et C2 (arêtes simples) ; D6 lit une PLAGE.
    expect(precedentsDirects(g, idDe(1, 2, 4)).cellules).toEqual([idDe(1, 2, 2), idDe(1, 2, 3)]);
    expect(precedentsDirects(g, idDe(1, 6, 4)).plages).toEqual([{ feuille: 1, plage: { r1: 2, c1: 4, r2: 5, c2: 4 } }]);
    // Le nom TauxTVA est résolu vers Param!B1 (une cellule → arête simple).
    expect(precedentsDirects(g, idDe(1, 7, 4)).cellules).toContain(idDe(3, 1, 2));
    // Qui dépend de D3 ? La somme, par la plage — pas par une arête.
    expect(dependantsDirects(g, 1, 3, 4)).toEqual([idDe(1, 6, 4)]);
    // Qui dépend de B3 ? D3, directement.
    expect(dependantsDirects(g, 1, 3, 2)).toEqual([idDe(1, 3, 4)]);
    // L'ordre : les totaux de ligne avant la somme, la somme avant la TVA et la synthèse.
    const pos = (id: string) => g.ordre.indexOf(id);
    expect(pos(idDe(1, 3, 4))).toBeLessThan(pos(idDe(1, 6, 4)));
    expect(pos(idDe(1, 6, 4))).toBeLessThan(pos(idDe(1, 7, 4)));
    expect(pos(idDe(1, 6, 4))).toBeLessThan(pos(idDe(2, 1, 2)));
    // Une feuille inconnue est DITE sur le nœud, jamais devinée.
    expect(g.noeuds.get(idDe(2, 2, 2))!.feuillesInconnues).toEqual(["Inconnue"]);
    expect(libelleCellule(classeur(), idDe(1, 6, 4))).toBe("Ventes!D6");
  });

  it("le rayon d'impact suit les arêtes ET les plages, sur plusieurs feuilles", () => {
    const g = construireGraphe(classeur());
    const r = rayonImpact(g, 1, 3, 2); // B3
    // D3 → la somme D6 (plage) → la TVA D7 et Synthèse!B1 → Synthèse!B2 qui lit B1.
    expect(new Set(r.formules)).toEqual(new Set([idDe(1, 3, 4), idDe(1, 6, 4), idDe(1, 7, 4), idDe(2, 1, 2), idDe(2, 2, 2)]));
    expect(r.tronque).toBe(false);
    // Param!B1 (le taux) n'impacte que la TVA.
    expect(rayonImpact(g, 3, 1, 2).formules).toEqual([idDe(1, 7, 4)]);
  });

  it("une référence circulaire est nommée, et les autres formules gardent leur ordre", () => {
    const c = classeur();
    const f = c.feuilles[0];
    poserCellule(f, { row: 10, col: 1, v: 0, t: "n", f: "A11+1" });
    poserCellule(f, { row: 11, col: 1, v: 0, t: "n", f: "A10+1" });
    const g = construireGraphe(c);
    expect(g.cycles).toHaveLength(1);
    expect(new Set(g.cycles[0])).toEqual(new Set([idDe(1, 10, 1), idDe(1, 11, 1)]));
    expect(g.ordre).toHaveLength(8);
  });

  it("tient l'échelle : 50 000 formules de ligne et des totaux de colonne en moins de deux secondes", () => {
    const f = nouvelleFeuille(1, "Grand");
    const N = 50_000;
    for (let r = 2; r <= N + 1; r++) {
      poserCellule(f, { row: r, col: 2, v: r, t: "n", f: null });
      poserCellule(f, { row: r, col: 3, v: 2, t: "n", f: null });
      poserCellule(f, { row: r, col: 4, v: r * 2, t: "n", f: `B${r}*C${r}` });
    }
    poserCellule(f, { row: N + 2, col: 4, v: 0, t: "n", f: `SUM(D2:D${N + 1})` });
    poserCellule(f, { row: N + 3, col: 4, v: 0, t: "n", f: `D${N + 2}*0.19` });
    const t0 = Date.now();
    const g = construireGraphe({ feuilles: [f], noms: [], limites: [] });
    const ms = Date.now() - t0;
    expect(g.metriques.formules).toBe(N + 2);
    expect(g.cycles).toEqual([]);
    expect(g.ordre.at(-1)).toBe(idDe(1, N + 3, 4));
    expect(rayonImpact(g, 1, 777, 2).formules).toEqual([idDe(1, 777, 4), idDe(1, N + 2, 4), idDe(1, N + 3, 4)]);
    expect(ms).toBeLessThan(2_000);
  });
});
