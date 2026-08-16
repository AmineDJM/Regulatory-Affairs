import { describe, it, expect } from "vitest";
import {
  clickSelect, selectAll, pruneSelection, isSelected, allSelected, EMPTY_SELECTION,
} from "./selection";

const ORDER = ["a", "b", "c", "d", "e"];

describe("Un clic simple : celui-là, et rien d'autre", () => {
  it("remplace la sélection existante", () => {
    const s = clickSelect({ ids: ["a", "b"], anchor: "b" }, "d", ORDER);
    expect(s.ids).toEqual(["d"]);
  });

  it("pose l'ancre pour la plage suivante", () => {
    expect(clickSelect(EMPTY_SELECTION, "c", ORDER).anchor).toBe("c");
  });
});

describe("Ctrl+clic : j'ajoute ou je retire, sans perdre le reste", () => {
  it("ajoute à la sélection", () => {
    const s = clickSelect({ ids: ["a"], anchor: "a" }, "c", ORDER, { toggle: true });
    expect(s.ids).toEqual(["a", "c"]);
  });

  it("retire un élément déjà pris, en gardant les autres", () => {
    const s = clickSelect({ ids: ["a", "c", "e"], anchor: "e" }, "c", ORDER, { toggle: true });
    expect(s.ids).toEqual(["a", "e"]);
  });

  it("repose l'ancre — la plage suivante part d'ici", () => {
    expect(clickSelect({ ids: ["a"], anchor: "a" }, "d", ORDER, { toggle: true }).anchor).toBe("d");
  });
});

describe("Maj+clic : toute la plage depuis l'ancre", () => {
  it("prend tout ce qui va de l'ancre au clic", () => {
    const s = clickSelect({ ids: ["b"], anchor: "b" }, "d", ORDER, { range: true });
    expect(s.ids).toEqual(["b", "c", "d"]);
  });

  it("fonctionne vers le HAUT comme vers le bas", () => {
    const s = clickSelect({ ids: ["d"], anchor: "d" }, "b", ORDER, { range: true });
    expect(s.ids).toEqual(["b", "c", "d"]);
  });

  it("L'ANCRE NE BOUGE PAS — on peut réduire ou inverser la plage sans qu'elle glisse", () => {
    // C'est le détail qui trahit une imitation approximative : déplacer l'ancre à chaque
    // Maj+clic donne une sélection qui « glisse » sous la souris.
    let s = clickSelect(EMPTY_SELECTION, "b", ORDER);
    s = clickSelect(s, "e", ORDER, { range: true });
    expect(s.ids).toEqual(["b", "c", "d", "e"]);
    s = clickSelect(s, "c", ORDER, { range: true }); // je réduis
    expect(s.ids).toEqual(["b", "c"]);
    expect(s.anchor).toBe("b");
    s = clickSelect(s, "a", ORDER, { range: true }); // j'inverse
    expect(s.ids).toEqual(["a", "b"]);
  });

  it("suit l'ordre AFFICHÉ, pas celui de la base", () => {
    // Après un tri par taille, Maj+clic doit prendre ce qu'on voit entre les deux lignes.
    const sorted = ["e", "d", "c", "b", "a"];
    const s = clickSelect({ ids: ["e"], anchor: "e" }, "c", sorted, { range: true });
    expect(s.ids).toEqual(["e", "d", "c"]);
  });

  it("sans ancre, se comporte comme un clic simple", () => {
    expect(clickSelect(EMPTY_SELECTION, "c", ORDER, { range: true }).ids).toEqual(["c"]);
  });

  it("une ancre disparue (liste changée) ne fabrique pas une plage absurde", () => {
    const s = clickSelect({ ids: [], anchor: "disparu" }, "c", ORDER, { range: true });
    expect(s.ids).toEqual(["c"]);
  });
});

describe("Tout sélectionner, et le ménage quand la liste change", () => {
  it("prend toute la liste, ou la vide", () => {
    expect(selectAll(ORDER, true).ids).toEqual(ORDER);
    expect(selectAll(ORDER, false)).toEqual(EMPTY_SELECTION);
  });

  it("oublie ce qui n'existe plus après une suppression", () => {
    // Sinon la barre annoncerait « 3 éléments » et l'action suivante porterait sur des
    // identifiants disparus.
    const s = pruneSelection({ ids: ["a", "b", "c"], anchor: "c" }, ["a", "c"]);
    expect(s.ids).toEqual(["a", "c"]);
  });

  it("oublie l'ancre disparue, sans toucher au reste", () => {
    const s = pruneSelection({ ids: ["a"], anchor: "z" }, ["a"]);
    expect(s.anchor).toBeNull();
    expect(s.ids).toEqual(["a"]);
  });

  it("ne fabrique pas un nouvel objet quand rien n'a changé", () => {
    // Un nouvel objet à chaque rendu relancerait les effets qui l'observent, en boucle.
    const state = { ids: ["a"], anchor: "a" };
    expect(pruneSelection(state, ORDER)).toBe(state);
  });

  it("répond aux deux questions de l'en-tête", () => {
    expect(isSelected({ ids: ["a"], anchor: "a" }, "a")).toBe(true);
    expect(allSelected({ ids: [...ORDER], anchor: "e" }, ORDER)).toBe(true);
    expect(allSelected({ ids: ["a"], anchor: "a" }, ORDER)).toBe(false);
    expect(allSelected(EMPTY_SELECTION, [])).toBe(false);
  });
});
