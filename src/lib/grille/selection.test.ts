import { describe, it, expect } from "vitest";
import {
  SELECTION_VIDE, cliquer, glisser, deplacer, borner, clesSelection, estSelectionnee, estVide,
  taille, versTsv, lignesSelectionnees, plage, clesDePlage, cle, deCle,
} from "./selection";

const B = { lignes: 5, colonnes: 4 };

describe("La sélection d'une feuille — le modèle d'Excel, au cas près", () => {
  it("un clic prend une seule cellule et oublie le reste", () => {
    let s = cliquer(SELECTION_VIDE, { r: 1, c: 1 });
    s = cliquer(s, { r: 3, c: 2 });
    expect([...clesSelection(s)]).toEqual(["3:2"]);
    expect(estVide(s)).toBe(false);
    expect(taille(s)).toBe(1);
  });

  it("Maj-clic tend une plage depuis l'ancre, quel que soit le sens", () => {
    let s = cliquer(SELECTION_VIDE, { r: 2, c: 2 });
    s = cliquer(s, { r: 0, c: 0 }, { shift: true });
    expect(taille(s)).toBe(9);
    expect(estSelectionnee(s, 1, 1)).toBe(true);
    expect(estSelectionnee(s, 3, 0)).toBe(false);
    // Un second Maj-clic RETEND depuis la même ancre : il ne cumule pas.
    s = cliquer(s, { r: 2, c: 3 }, { shift: true });
    expect(taille(s)).toBe(2);
    expect(estSelectionnee(s, 0, 0)).toBe(false);
  });

  it("Ctrl-clic ajoute une cellule isolée, et la retire si elle était déjà prise", () => {
    let s = cliquer(SELECTION_VIDE, { r: 0, c: 0 });
    s = cliquer(s, { r: 4, c: 3 }, { ctrl: true });
    expect([...clesSelection(s)].sort()).toEqual(["0:0", "4:3"]);
    // Retrait : la cellule quitte la sélection, ce qui reste est ce qui était figé.
    s = cliquer(s, { r: 4, c: 3 }, { ctrl: true });
    expect([...clesSelection(s)]).toEqual(["0:0"]);
    expect(s.ancre).toBeNull();
    // Et l'on peut repartir de là au clavier : la première flèche prend la première cellule.
    s = deplacer(s, "droite", B);
    expect([...clesSelection(s)]).toEqual(["0:0"]);
  });

  it("Ctrl puis Maj : la plage courante s'ajoute aux figées au lieu de les remplacer", () => {
    let s = cliquer(SELECTION_VIDE, { r: 0, c: 0 });
    s = cliquer(s, { r: 2, c: 0 }, { ctrl: true });
    s = cliquer(s, { r: 2, c: 2 }, { shift: true });
    expect([...clesSelection(s)].sort()).toEqual(["0:0", "2:0", "2:1", "2:2"]);
  });

  it("glisser étend depuis l'ancre ; glisser sans ancre en crée une", () => {
    let s = cliquer(SELECTION_VIDE, { r: 1, c: 1 });
    s = glisser(s, { r: 2, c: 3 });
    expect(taille(s)).toBe(6);
    const t = glisser(SELECTION_VIDE, { r: 0, c: 1 });
    expect([...clesSelection(t)]).toEqual(["0:1"]);
  });

  it("une flèche sans Maj repart d'une cellule, avec Maj elle étend, et jamais hors des bornes", () => {
    let s = cliquer(SELECTION_VIDE, { r: 0, c: 0 });
    s = deplacer(s, "haut", B); // déjà en haut : on ne sort pas
    expect([...clesSelection(s)]).toEqual(["0:0"]);
    s = deplacer(s, "bas", B, { shift: true });
    s = deplacer(s, "droite", B, { shift: true });
    expect(taille(s)).toBe(4);
    s = deplacer(s, "droite", B);
    expect([...clesSelection(s)]).toEqual(["1:2"]);
    // Bord droit : la colonne ne dépasse pas la dernière.
    s = deplacer(s, "droite", B); s = deplacer(s, "droite", B); s = deplacer(s, "droite", B);
    expect(s.focus).toEqual({ r: 1, c: 3 });
  });

  it("borner ramène une sélection qui déborde après un filtre, et vide ce qui n'existe plus", () => {
    let s = cliquer(SELECTION_VIDE, { r: 0, c: 0 });
    s = cliquer(s, { r: 4, c: 3 }, { shift: true });
    // L'ancre (0,0) tient, le focus (4,3) est sorti : la plage tombe entière — une plage à
    // moitié visible serait une plage qu'on ne peut plus lire.
    expect(estVide(borner(s, { lignes: 2, colonnes: 4 }))).toBe(true);
    // Une figée hors bornes disparaît, la plage courante qui tient reste.
    let t = cliquer(SELECTION_VIDE, { r: 4, c: 0 });
    t = cliquer(t, { r: 1, c: 1 }, { ctrl: true });
    expect([...clesSelection(borner(t, { lignes: 2, colonnes: 4 }))]).toEqual(["1:1"]);
    expect(borner(s, { lignes: 0, colonnes: 4 })).toEqual(SELECTION_VIDE);
  });
});

describe("Copier ce qui est sélectionné", () => {
  const valeur = (r: number, c: number) => `v${r}${c}`;

  it("rend un TSV sur le rectangle englobant, les trous vides", () => {
    let s = cliquer(SELECTION_VIDE, { r: 0, c: 0 });
    s = cliquer(s, { r: 1, c: 1 }, { shift: true });
    expect(versTsv(s, valeur)).toBe("v00\tv01\nv10\tv11");
    s = cliquer(SELECTION_VIDE, { r: 0, c: 0 });
    s = cliquer(s, { r: 1, c: 2 }, { ctrl: true });
    expect(versTsv(s, valeur)).toBe("v00\t\t\n\t\tv12");
  });

  it("une tabulation ou un retour à la ligne DANS une valeur ne casse pas la grille collée", () => {
    const s = cliquer(SELECTION_VIDE, { r: 0, c: 0 });
    expect(versTsv(s, () => "12 rue\tX\nAlger")).toBe("12 rue X Alger");
    expect(versTsv(SELECTION_VIDE, valeur)).toBe("");
  });

  it("les lignes touchées sortent triées et sans doublon", () => {
    let s = cliquer(SELECTION_VIDE, { r: 3, c: 0 });
    s = cliquer(s, { r: 1, c: 2 }, { shift: true });
    s = cliquer(s, { r: 0, c: 3 }, { ctrl: true });
    expect(lignesSelectionnees(s)).toEqual([0, 1, 2, 3]);
  });
});

describe("Outils de coordonnées", () => {
  it("plage normalise les coins, clesDePlage énumère, cle/deCle font l'aller-retour", () => {
    expect(plage({ r: 3, c: 2 }, { r: 1, c: 0 })).toEqual({ r1: 1, c1: 0, r2: 3, c2: 2 });
    expect(clesDePlage({ r1: 0, c1: 0, r2: 1, c2: 1 })).toEqual(["0:0", "0:1", "1:0", "1:1"]);
    expect(deCle(cle(7, 2))).toEqual({ r: 7, c: 2 });
    expect(deCle("x")).toBeNull();
  });
});
