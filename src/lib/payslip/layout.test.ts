import { describe, it, expect } from "vitest";
import {
  columnWidths, effectiveSizePt, fontName, needsNewPage,
  BASE_SIZE_PT, HEADING_SIZE_PT, MIN_SIZE_PT, MAX_SIZE_PT,
} from "./layout";

describe("la taille d'un fragment", () => {
  it("suit le document quand il la déclare", () => {
    expect(effectiveSizePt({ bold: false, italic: false, sizePt: 12 }, false)).toBe(12);
  });

  it("retombe sur le corps de texte, ou sur la taille de titre", () => {
    expect(effectiveSizePt({ bold: false, italic: false, sizePt: null }, false)).toBe(BASE_SIZE_PT);
    expect(effectiveSizePt({ bold: false, italic: false, sizePt: null }, true)).toBe(HEADING_SIZE_PT);
  });

  it("une taille ABERRANTE est bornée — sinon la page n'affiche plus qu'un mot", () => {
    // Un `w:sz` corrompu ou une feuille de style exotique ne doit pas produire un document
    // qu'on croit vide.
    expect(effectiveSizePt({ bold: false, italic: false, sizePt: 0.2 }, false)).toBe(MIN_SIZE_PT);
    expect(effectiveSizePt({ bold: false, italic: false, sizePt: 900 }, false)).toBe(MAX_SIZE_PT);
  });
});

describe("la police", () => {
  it("les quatre variantes se distinguent, et un titre est gras", () => {
    const r = (bold: boolean, italic: boolean) => fontName({ bold, italic, sizePt: null }, false);
    expect(r(false, false)).toBe("Helvetica");
    expect(r(true, false)).toBe("Helvetica-Bold");
    expect(r(false, true)).toBe("Helvetica-Oblique");
    expect(r(true, true)).toBe("Helvetica-BoldOblique");
    expect(fontName({ bold: false, italic: false, sizePt: null }, true)).toBe("Helvetica-Bold");
  });
});

describe("les largeurs de colonnes — le cœur d'un bulletin de paie", () => {
  const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it("elles occupent EXACTEMENT la largeur disponible", () => {
    // Déborder sort les montants de la page ; laisser un blanc décale les colonnes.
    const w = columnWidths([["Libellé", "Base", "Taux", "Montant"], ["Salaire de base", "173,33", "1 082,00", "187 450,00"]], 500);
    expect(somme(w)).toBeCloseTo(500, 6);
  });

  it("une colonne large reçoit plus qu'une colonne étroite", () => {
    const w = columnWidths([["Désignation très longue de la ligne de paie", "12"]], 400);
    expect(w[0]).toBeGreaterThan(w[1]);
  });

  it("une colonne d'UN caractère garde un plancher — sinon son texte se brise verticalement", () => {
    const w = columnWidths([["N", "Un libellé vraiment très long qui écrase tout le reste"]], 400);
    expect(w[0]).toBeGreaterThan(10);
  });

  it("une colonne bavarde n'absorbe pas toute la table — ce sont les MONTANTS qu'on vient lire", () => {
    const bavard = "commentaire ".repeat(40);
    const w = columnWidths([["Libellé", bavard, "187 450,00"]], 500);
    expect(w[1]).toBeLessThanOrEqual(500 * 0.6 + 1);
    expect(w[2]).toBeGreaterThan(20);
  });

  it("les lignes irrégulières ne cassent rien", () => {
    // Un `.docx` réel a des lignes fusionnées : toutes n'ont pas le même nombre de cellules.
    const w = columnWidths([["a", "b", "c"], ["seul"]], 300);
    expect(w).toHaveLength(3);
    expect(somme(w)).toBeCloseTo(300, 6);
  });

  it("un tableau vide, ou une largeur nulle, ne rend rien", () => {
    expect(columnWidths([], 500)).toEqual([]);
    expect(columnWidths([["a"]], 0)).toEqual([]);
  });

  it("une colonne unique prend toute la largeur", () => {
    expect(columnWidths([["seul"]], 480)).toEqual([480]);
  });
});

describe("le saut de page", () => {
  it("on ne laisse pas une ligne solitaire en bas de page", () => {
    // Sa suite est ailleurs : on la lit deux fois avant de comprendre.
    expect(needsNewPage(790, 100, 800, 12)).toBe(true);
  });

  it("un bloc qui tient reste sur la page", () => {
    expect(needsNewPage(100, 200, 800, 12)).toBe(false);
  });

  it("un bloc PLUS GRAND qu'une page ne provoque pas un saut infini", () => {
    // On le commence là où l'on est ; il débordera sur la page suivante, et c'est le seul
    // comportement qui termine.
    expect(needsNewPage(60, 5000, 800, 12)).toBe(false);
  });
});
