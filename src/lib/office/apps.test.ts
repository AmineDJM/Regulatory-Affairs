import { describe, it, expect } from "vitest";
import {
  OFFICE_APPS, officeApp, appOfFile, parsePinned, togglePinned, pinnedApps, officeHref,
  type OfficeAppKey,
} from "./apps";

describe("Les trois applications, et rien de plus", () => {
  it("Word, Excel, PowerPoint — dans cet ordre", () => {
    expect(OFFICE_APPS.map((a) => a.key)).toEqual(["word", "cell", "slide"]);
    expect(OFFICE_APPS.map((a) => a.label)).toEqual(["Word", "Excel", "PowerPoint"]);
  });

  it("chacune dit CE QU'ON VIENT Y FAIRE, pas ce qu'est le format", () => {
    for (const a of OFFICE_APPS) {
      expect(a.hint.length, a.key).toBeGreaterThan(20);
      expect(a.defaultName.length, a.key).toBeGreaterThan(0);
      expect(a.tone.length, a.key).toBeGreaterThan(0);
    }
  });

  it("les vrais formats, pas des équivalents maison", () => {
    expect(OFFICE_APPS.map((a) => a.ext)).toEqual(["docx", "xlsx", "pptx"]);
  });

  it("une clé inconnue ne casse rien", () => {
    expect(officeApp("n-existe-pas")).toBeUndefined();
  });
});

describe("Reconnaître un document depuis son nom", () => {
  it("ouvre le bon éditeur selon l'extension, quelle que soit la casse", () => {
    expect(appOfFile("Rapport.docx")?.key).toBe("word");
    expect(appOfFile("Budget 2026.XLSX")?.key).toBe("cell");
    expect(appOfFile("Comité.pptx")?.key).toBe("slide");
  });

  it("un PDF ou un fichier sans extension n'est pas un document bureautique", () => {
    expect(appOfFile("notice.pdf")).toBeUndefined();
    expect(appOfFile("LISEZMOI")).toBeUndefined();
  });
});

describe("Les épingles du menu — la préférence de chacun", () => {
  it("part de rien, et une valeur abîmée ne casse pas le menu", () => {
    // Un menu qui disparaît parce qu'une préférence a été éditée à la main serait bien pire
    // que l'absence d'épingle.
    expect(parsePinned(null)).toEqual([]);
    expect(parsePinned("pas du json")).toEqual([]);
    expect(parsePinned('{"word":true}')).toEqual([]);
    expect(parsePinned('["word","inconnue",42]')).toEqual(["word"]);
  });

  it("ignore les doublons", () => {
    expect(parsePinned('["word","word","cell"]')).toEqual(["word", "cell"]);
  });

  it("épingle, puis retire", () => {
    const one = togglePinned([], "cell");
    expect(one).toEqual(["cell"]);
    expect(togglePinned(one, "cell")).toEqual([]);
  });

  it("conserve l'ordre d'ajout — le menu ne se réorganise pas tout seul", () => {
    let pins: OfficeAppKey[] = [];
    pins = togglePinned(pins, "slide");
    pins = togglePinned(pins, "word");
    expect(pins).toEqual(["slide", "word"]);
    expect(pinnedApps(pins).map((a) => a.label)).toEqual(["PowerPoint", "Word"]);
  });

  it("une épingle vers une application disparue est simplement ignorée", () => {
    expect(pinnedApps(["word", "n-existe-plus" as OfficeAppKey])).toHaveLength(1);
  });

  it("chaque application a un lien qui l'ouvre directement", () => {
    expect(officeHref("cell")).toBe("/office?app=cell");
    for (const a of OFFICE_APPS) expect(officeHref(a.key)).toContain(a.key);
  });
});
