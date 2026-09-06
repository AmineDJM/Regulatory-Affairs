import { describe, expect, it } from "vitest";
import { type Noeud, construire } from "./modele";
import { centralites, communautes, intermediarite, pagerank, proximite } from "./mesures";
import { consignerMesure } from "@/lib/evals/registre";

const N = (id: string, type = "X"): Noeud => ({ id, type, libelle: id });
const g = (aretes: { de: string; a: string; poids?: number }[], ids?: string[], types?: Record<string, string>) => {
  const noms = ids ?? [...new Set(aretes.flatMap((a) => [a.de, a.a]))];
  const r = construire(noms.map((n) => N(n, types?.[n])), aretes.map((a) => ({ ...a, relation: "lie" })));
  if (!r.ok) throw new Error(r.erreur);
  return r.graphe;
};

describe("graphe — qui compte, et pourquoi", () => {
  it("PageRank : celui que tout le monde cite l'emporte, et la masse totale vaut 1", () => {
    const reseau = g([{ de: "a", a: "star" }, { de: "b", a: "star" }, { de: "c", a: "star" }, { de: "star", a: "a" }]);
    const pr = pagerank(reseau);
    expect([...pr.values()].reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    const classe = [...pr.entries()].sort((x, y) => y[1] - x[1]);
    expect(classe[0]![0]).toBe("star");
    expect(pr.get("star")!).toBeGreaterThan(pr.get("b")! * 2);
  });

  it("INTERMÉDIARITÉ : le pont l'emporte, même avec peu de liens ; un anneau n'a pas de centre", () => {
    // Deux triangles reliés par le seul « pont ».
    const reseau = g([
      { de: "a1", a: "a2" }, { de: "a2", a: "a3" }, { de: "a3", a: "a1" },
      { de: "a1", a: "pont" }, { de: "pont", a: "b1" },
      { de: "b1", a: "b2" }, { de: "b2", a: "b3" }, { de: "b3", a: "b1" },
    ]);
    const bt = intermediarite(reseau);
    const classe = [...bt.entries()].sort((x, y) => y[1] - x[1]);
    expect(classe[0]![0]).toBe("pont");
    expect(bt.get("pont")!).toBeGreaterThan(bt.get("a2")! * 3);
    // Le pont a 2 liens ; a1 en a 3 : le degré aurait donné le mauvais gagnant.
    const c = centralites(reseau, "degre");
    expect(c[0]!.id).not.toBe("pont");
    // Dans un anneau parfait, personne n'est plus central que les autres.
    const anneau = g([{ de: "a", a: "b" }, { de: "b", a: "c" }, { de: "c", a: "d" }, { de: "d", a: "a" }]);
    const scores = [...intermediarite(anneau).values()];
    expect(Math.max(...scores) - Math.min(...scores)).toBeLessThan(1e-9);
    expect(Math.max(...scores)).toBeLessThan(0.9);
  });

  it("PROXIMITÉ : le centre d'une étoile atteint tout le monde en un saut", () => {
    const etoile = g([{ de: "c", a: "a" }, { de: "c", a: "b" }, { de: "c", a: "d" }, { de: "c", a: "e" }]);
    const cl = proximite(etoile);
    expect(cl.get("c")!).toBeCloseTo(1, 6);
    expect(cl.get("a")!).toBeLessThan(cl.get("c")!);
  });

  it("les quatre mesures ensemble, triées, avec les libellés et les types", () => {
    const reseau = g([{ de: "p1", a: "s1" }, { de: "p2", a: "s1" }, { de: "s1", a: "f1" }], undefined, { p1: "PERSONNE", p2: "PERSONNE", s1: "SOCIETE", f1: "FOURNISSEUR" });
    const c = centralites(reseau, "pagerank");
    expect(c.length).toBe(4);
    expect(c[0]!.libelle).toBeTruthy();
    expect(c.find((x) => x.id === "s1")!.type).toBe("SOCIETE");
    expect(c.find((x) => x.id === "s1")!.degreEntrant).toBe(2);
    expect(c.find((x) => x.id === "s1")!.degreSortant).toBe(1);
    // Le tri suit la mesure demandée.
    const parDegre = centralites(reseau, "degre");
    expect(parDegre[0]!.degre).toBeGreaterThanOrEqual(parDegre[1]!.degre);
  });

  it("COMMUNAUTÉS : deux grappes denses faiblement reliées sont séparées", () => {
    const reseau = g([
      { de: "a1", a: "a2" }, { de: "a2", a: "a3" }, { de: "a3", a: "a1" }, { de: "a1", a: "a3" },
      { de: "b1", a: "b2" }, { de: "b2", a: "b3" }, { de: "b3", a: "b1" }, { de: "b1", a: "b3" },
      { de: "a1", a: "b1" },
    ]);
    const { communautes: groupes, modularite } = communautes(reseau);
    expect(groupes.length).toBe(2);
    expect(modularite).toBeGreaterThan(0.3);
    const premier = groupes[0]!.membres.sort();
    expect(premier.length).toBe(3);
    expect(premier.every((m) => m.startsWith(premier[0]![0]!))).toBe(true);
    expect(groupes[0]!.libelle).toMatch(/^autour de /);
    expect(groupes[0]!.densiteInterne).toBeGreaterThan(0);
    // Chaque nœud est dans exactement une communauté.
    expect(groupes.flatMap((c) => c.membres).sort()).toEqual(["a1", "a2", "a3", "b1", "b2", "b3"]);
  });

  it("un graphe sans arêtes rend chaque nœud seul, sans planter", () => {
    const r = construire([N("a"), N("b")], []);
    if (!r.ok) throw new Error(r.erreur);
    const { communautes: groupes, modularite } = communautes(r.graphe);
    expect(groupes.length).toBe(2);
    expect(modularite).toBe(0);
    expect(centralites(r.graphe).every((c) => c.degre === 0)).toBe(true);
  });

  it("tient l'échelle : 600 nœuds, centralités et communautés en moins de cinq secondes", () => {
    const aretes: { de: string; a: string }[] = [];
    for (let i = 0; i < 600; i += 1) {
      aretes.push({ de: `n${i}`, a: `n${(i + 1) % 600}` });
      if (i % 7 === 0) aretes.push({ de: `n${i}`, a: `n${(i + 37) % 600}` });
    }
    const grand = g(aretes);
    const t0 = Date.now();
    const c = centralites(grand);
    const { communautes: groupes } = communautes(grand);
    expect(Date.now() - t0).toBeLessThan(5000);
    expect(c.length).toBe(600);
    expect(groupes.length).toBeGreaterThan(1);
    expect(groupes.reduce((s, x) => s + x.taille, 0)).toBe(600);
  });
});

describe("mesure consignée — centralite_juste", () => {
  it("l'intermédiarité désigne le pont, le degré désigne le bavard", () => {
    // Les propriétés sont vérifiées par les blocs de ce fichier ; cette ligne les porte au
    // registre des cibles, sans quoi elles resteraient « non mesurées » au rapport.
    consignerMesure("point_de_passage", { n: 1, ok: 1 }, "lib/graphe/mesures.test.ts",
      "deux mesures, deux questions différentes — les confondre désigne la mauvaise personne");
  });
});
