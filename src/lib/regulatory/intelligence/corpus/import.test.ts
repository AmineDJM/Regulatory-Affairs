import { describe, it, expect } from "vitest";
import { splitIntoSections } from "./import";

describe("splitIntoSections — découpage en articles/sections", () => {
  it("découpe par en-têtes d'article", () => {
    const s = splitIntoSections("Article 4 : Pièces du dossier.\nLe dossier comporte…\nArticle 5 : Délais.\nLe délai est de 90 jours.");
    expect(s.length).toBe(2);
    expect(s[0].path.toLowerCase()).toContain("article 4");
    expect(s[1].path.toLowerCase()).toContain("article 5");
    expect(s[1].text).toContain("90 jours");
  });

  it("reconnaît annexes et numérotation CTD", () => {
    const s = splitIntoSections("Annexe I : Formulaire.\nContenu.\n3.2.P.8 Stabilité\nÉtudes de stabilité.");
    expect(s.some((x) => /annexe/i.test(x.path))).toBe(true);
    expect(s.some((x) => x.path.startsWith("3.2"))).toBe(true);
  });

  it("sans en-tête : découpe par blocs de paragraphes", () => {
    const s = splitIntoSections("Premier paragraphe réglementaire.\n\nSecond paragraphe distinct.");
    expect(s.length).toBe(2);
    expect(s[0].path).toBe("§1");
  });

  it("texte vide → aucune section", () => {
    expect(splitIntoSections("")).toHaveLength(0);
  });
});
