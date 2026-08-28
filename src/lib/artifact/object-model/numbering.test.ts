/**
 * LA NUMÉROTATION HUMAINE (§17) — le test qui existe parce que l'erreur coûte cher.
 *
 * « Supprime les pages 12, 14 et 18 » : si le code convertit mal, il supprime les pages 13, 15
 * et 19 d'un contrat signé, et personne ne s'en aperçoit avant l'envoi. Ce fichier reproduit
 * exactement les deux décalages possibles :
 *
 *   1. l'oubli du -1 (page humaine → index de bibliothèque) ;
 *   2. la suppression en ordre CROISSANT, qui décale les pages suivantes à chaque retrait.
 *
 * Il vérifie aussi que les paragraphes de tableau ne comptent PAS dans le rang d'un paragraphe :
 * « le troisième paragraphe » désigne le troisième que la personne voit.
 */

import { describe, it, expect } from "vitest";
import { adaptateurPdf } from "@/lib/artifact/adapters/pdf/adapter";
import { adaptateurDocx } from "@/lib/artifact/adapters/docx/adapter";
import { commande, cibleIndex } from "@/lib/artifact/commands/ir";
import type { DocxModel, PdfModel } from "@/lib/artifact/object-model/model";
import {
  analyserPlage, analyserRef, colonneEnNombre, formerRef, nombreEnColonne,
} from "@/lib/artifact/object-model/model";
import { pdfNumerote, docxDeParagraphes } from "@/lib/artifact/adapters/fixtures";

describe("numérotation humaine — PDF", () => {
  it("la page 1 est la PREMIÈRE page", async () => {
    const doc = await adaptateurPdf.ouvrir(await pdfNumerote(5));
    const m = doc.modele() as PdfModel;
    expect(m.pages[0].index).toBe(1);
    expect(m.pages[0].preview).toContain("Page 1");
    expect(m.pages[4].index).toBe(5);
  });

  it("supprimer les pages 12, 14 et 18 retire EXACTEMENT celles-là", async () => {
    const doc = await adaptateurPdf.ouvrir(await pdfNumerote(20));
    const effet = doc.appliquer(commande("pdf.supprimer_pages", { pages: [12, 14, 18] }));
    expect(effet.ok).toBe(true);

    const m = doc.modele() as PdfModel;
    expect(m.pages).toHaveLength(17);
    const restantes = m.pages.map((p) => Number(/Page (\d+)/.exec(p.preview)?.[1]));
    expect(restantes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 16, 17, 19, 20]);
    // Les trois demandées, et elles seules, ont disparu.
    expect(restantes).not.toContain(12);
    expect(restantes).not.toContain(14);
    expect(restantes).not.toContain(18);
  });

  it("une page hors limites est REFUSÉE avant toute suppression", async () => {
    const doc = await adaptateurPdf.ouvrir(await pdfNumerote(5));
    const effet = doc.appliquer(commande("pdf.supprimer_pages", { pages: [2, 9] }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("9");
    // Rien n'a bougé : le refus est ATOMIQUE, il ne laisse pas la page 2 supprimée.
    expect((doc.modele() as PdfModel).pages).toHaveLength(5);
  });

  it("la page 0 est refusée par le compilateur — on ne compte pas à partir de zéro", async () => {
    const doc = await adaptateurPdf.ouvrir(await pdfNumerote(3));
    const effet = doc.appliquer(commande("pdf.supprimer_pages", { pages: [0] }));
    expect(effet.ok).toBe(false);
  });
});

describe("numérotation humaine — Word", () => {
  it("le troisième paragraphe est le TROISIÈME que la personne voit", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxDeParagraphes(["Titre", "Alpha", "Bravo", "Charlie"]));
    const m = doc.modele() as DocxModel;
    expect(m.paragraphs.map((p) => p.index)).toEqual([1, 2, 3, 4]);
    expect(m.paragraphs[2].text).toBe("Bravo");

    const effet = doc.appliquer(commande("docx.supprimer_paragraphe", { cible: cibleIndex(3) }));
    expect(effet.ok).toBe(true);
    const apres = (doc.modele() as DocxModel).paragraphs.map((p) => p.text);
    expect(apres).toEqual(["Titre", "Alpha", "Charlie"]);
  });

  it("les rangs se RECALCULENT après une suppression", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxDeParagraphes(["A", "B", "C", "D"]));
    doc.appliquer(commande("docx.supprimer_paragraphe", { cible: cibleIndex(2) }));
    const m = doc.modele() as DocxModel;
    expect(m.paragraphs.map((p) => [p.index, p.text])).toEqual([[1, "A"], [2, "C"], [3, "D"]]);
    // Un second « supprime le 2 » retire bien C, qui est maintenant le deuxième.
    doc.appliquer(commande("docx.supprimer_paragraphe", { cible: cibleIndex(2) }));
    expect((doc.modele() as DocxModel).paragraphs.map((p) => p.text)).toEqual(["A", "D"]);
  });

  it("les paragraphes DANS un tableau ne comptent pas dans le rang", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxDeParagraphes(["Titre", "Intro"], { tableau: [["A1", "B1"], ["A2", "B2"]] }));
    const m = doc.modele() as DocxModel;
    // Le tableau ajoute quatre paragraphes de cellule ; le modèle n'en numérote aucun.
    expect(m.paragraphs.map((p) => p.text)).toEqual(["Titre", "Intro"]);
    expect(m.paragraphs.every((p) => !p.inTable)).toBe(true);
    expect(m.tables).toHaveLength(1);
    expect(m.tables[0].index).toBe(1);
    expect(m.tables[0].cells.map((c) => [c.row, c.col])).toContainEqual([1, 1]);
    expect(m.tables[0].cells.map((c) => [c.row, c.col])).not.toContainEqual([0, 0]);
  });

  it("un rang inexistant le dit, avec le compte réel", async () => {
    const doc = await adaptateurDocx.ouvrir(await docxDeParagraphes(["A", "B"]));
    const effet = doc.appliquer(commande("docx.supprimer_paragraphe", { cible: cibleIndex(7) }));
    expect(effet.ok).toBe(false);
    expect(effet.motif).toContain("7");
    expect(effet.motif).toContain("2");
  });
});

describe("numérotation Excel — les colonnes commencent à A = 1", () => {
  it("A ↔ 1, Z ↔ 26, AA ↔ 27", () => {
    expect(colonneEnNombre("A")).toBe(1);
    expect(colonneEnNombre("Z")).toBe(26);
    expect(colonneEnNombre("AA")).toBe(27);
    expect(nombreEnColonne(1)).toBe("A");
    expect(nombreEnColonne(26)).toBe("Z");
    expect(nombreEnColonne(27)).toBe("AA");
    expect(nombreEnColonne(702)).toBe("ZZ");
    expect(colonneEnNombre("ZZ")).toBe(702);
  });

  it("B4 se lit ligne 4, colonne 2 — et se réécrit à l'identique", () => {
    expect(analyserRef("B4")).toEqual({ row: 4, col: 2 });
    expect(formerRef(4, 2)).toBe("B4");
    expect(analyserRef("$B$4")).toEqual({ row: 4, col: 2 });
  });

  it("B4:B20 énumère 17 cellules, bornes comprises", () => {
    const p = analyserPlage("B4:B20");
    expect(p).not.toBeNull();
    expect(p!.from).toEqual({ row: 4, col: 2 });
    expect(p!.to).toEqual({ row: 20, col: 2 });
    // 20 − 4 + 1 : les DEUX bornes sont dans la plage. L'oubli du « +1 » est le décalage classique.
    expect(p!.to.row - p!.from.row + 1).toBe(17);
  });

  it("une plage écrite à l'envers est normalisée", () => {
    expect(analyserPlage("D20:B4")).toEqual({ from: { row: 4, col: 2 }, to: { row: 20, col: 4 } });
  });
});
