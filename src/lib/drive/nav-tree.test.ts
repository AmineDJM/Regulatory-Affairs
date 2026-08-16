import { describe, it, expect } from "vitest";
import { buildNavTree, ancestorsOf, MAX_TREE_DEPTH, type FlatFolder } from "./nav-tree";

const f = (id: string, parentId: string | null = null, spaceId: string | null = null): FlatFolder =>
  ({ id, name: id.toUpperCase(), parentId, spaceId });

describe("Une liste plate devient l'arbre du volet de navigation", () => {
  it("imbrique les dossiers sous leur parent", () => {
    const tree = buildNavTree([f("a"), f("b", "a"), f("c", "b")], null);
    expect(tree.map((t) => t.id)).toEqual(["a"]);
    expect(tree[0].children[0].id).toBe("b");
    expect(tree[0].children[0].children[0].id).toBe("c");
  });

  it("chaque niveau connaît sa profondeur — c'est elle qui produit le retrait à l'écran", () => {
    const tree = buildNavTree([f("a"), f("b", "a")], null);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
  });

  it("sépare les emplacements : une catégorie ne montre pas les dossiers d'une autre", () => {
    const all = [f("perso"), f("promo", null, "sp1"), f("reg", null, "sp2")];
    expect(buildNavTree(all, null).map((t) => t.id)).toEqual(["perso"]);
    expect(buildNavTree(all, "sp1").map((t) => t.id)).toEqual(["promo"]);
  });

  it("un dossier dont le parent est ABSENT reste visible, remonté à la racine", () => {
    // Le parent peut être hors de notre portée, ou la liste avoir été tronquée. Le faire
    // disparaître rendrait introuvable un dossier auquel on a pourtant accès.
    const tree = buildNavTree([f("orphelin", "parent-inconnu")], null);
    expect(tree.map((t) => t.id)).toEqual(["orphelin"]);
    expect(tree[0].depth).toBe(0);
  });

  it("un cycle ne fige pas l'onglet", () => {
    // A dans B, B dans A : rare, mais une boucle infinie bloque tout le navigateur.
    const tree = buildNavTree([f("a", "b"), f("b", "a")], null);
    const count = (nodes: { children: unknown[] }[]): number =>
      nodes.reduce((n, x) => n + 1 + count(x.children as { children: unknown[] }[]), 0);
    expect(count(tree)).toBeLessThanOrEqual(2);
  });

  it("cesse de descendre au-delà de la profondeur utile", () => {
    const deep: FlatFolder[] = [f("n0")];
    for (let i = 1; i < MAX_TREE_DEPTH + 4; i++) deep.push(f(`n${i}`, `n${i - 1}`));
    let level = buildNavTree(deep, null);
    let depth = 0;
    while (level.length > 0) { depth += 1; level = level[0].children; }
    expect(depth).toBe(MAX_TREE_DEPTH);
  });

  it("une liste vide rend un arbre vide, sans lever", () => {
    expect(buildNavTree([], null)).toEqual([]);
  });
});

describe("Retrouver la chaîne des parents — pour ouvrir le bon tiroir à l'arrivée", () => {
  const list = [f("a"), f("b", "a"), f("c", "b")];

  it("rend les ancêtres du plus proche au plus lointain", () => {
    expect(ancestorsOf(list, "c")).toEqual(["b", "a"]);
  });

  it("une racine n'a pas d'ancêtre ; un inconnu non plus", () => {
    expect(ancestorsOf(list, "a")).toEqual([]);
    expect(ancestorsOf(list, "n-existe-pas")).toEqual([]);
  });

  it("un cycle ne boucle pas", () => {
    expect(ancestorsOf([f("x", "y"), f("y", "x")], "x").length).toBeLessThanOrEqual(2);
  });
});
