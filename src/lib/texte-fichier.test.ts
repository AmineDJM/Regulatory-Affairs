import { describe, it, expect } from "vitest";
import { estUnTexteEditable, lireTexte, texteAEnregistrer } from "./texte-fichier";
import { onlyofficeDocType, onlyofficeTypeOuvrable } from "./onlyoffice";

describe("le texte se lit et se modifie sur le serveur", () => {
  it("seuls les fichiers texte sont éditables ici", () => {
    for (const n of ["a.json", "b.md", "c.log", "d.yml", "e.sql", "f.ts"]) expect(estUnTexteEditable(n), n).toBe(true);
    for (const n of ["a.docx", "b.pdf", "c.png", "d.zip", "e.exe"]) expect(estUnTexteEditable(n), n).toBe(false);
  });

  it("un fichier de plus d'1 Mo s'affiche tronqué", () => {
    const grand = Buffer.alloc(1_000_001, "a");
    const r = lireTexte(grand);
    expect(r.tronque).toBe(true);
    expect(r.texte.length).toBe(1_000_000);
    expect(lireTexte(Buffer.from("é à ç"))).toEqual({ texte: "é à ç", tronque: false });
  });

  it("un fichier tronqué à l'affichage ne se réécrit JAMAIS (on écraserait la fin non montrée)", () => {
    const r = texteAEnregistrer("début seulement", true);
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.error).toMatch(/dépasse 1 Mo/);
  });

  it("le texte à enregistrer est vérifié : une chaîne, pas plus d'1 Mo", () => {
    expect(texteAEnregistrer(42, false).ok).toBe(false);
    expect(texteAEnregistrer("x".repeat(1_000_001), false).ok).toBe(false);
    const ok = texteAEnregistrer("ligne 1\nligne 2 é", false);
    expect(ok.ok && ok.octets.toString("utf8")).toBe("ligne 1\nligne 2 é");
  });
});

describe("l'éditeur Office ouvre les anciens formats (lecture), et édite ceux qui se réécrivent", () => {
  it("anciens et exotiques : ouvrables en lecture, pas réécrits", () => {
    for (const n of ["a.dot", "a.pps", "a.xlsb", "a.pages", "a.key", "a.numbers", "a.epub", "a.wps"]) {
      expect(onlyofficeTypeOuvrable(n), n).not.toBeNull();
      expect(onlyofficeDocType(n), `${n} ne se réécrit pas fidèlement`).toBeNull();
    }
  });

  it("Word, Excel, PowerPoint et leurs variantes sont éditables", () => {
    for (const n of ["a.docx", "a.doc", "a.rtf", "a.odt", "a.xlsx", "a.xls", "a.ods", "a.csv", "a.pptx", "a.ppt", "a.odp", "a.docm", "a.xlsm", "a.pptm"]) {
      expect(onlyofficeDocType(n), n).not.toBeNull();
    }
  });

  it("un binaire ne s'ouvre pas dans l'éditeur", () => {
    expect(onlyofficeTypeOuvrable("setup.exe")).toBeNull();
    expect(onlyofficeTypeOuvrable("photo.png")).toBeNull();
  });
});
