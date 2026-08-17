import { describe, it, expect } from "vitest";
import { fileGlyph } from "./file-glyph";

const fam = (name: string) => fileGlyph(name, true).family;
const badge = (name: string) => fileGlyph(name, true).badge;

describe("Chaque famille de fichiers se reconnaît d'un coup d'œil", () => {
  it("les quatre bureautiques ne se confondent plus", () => {
    // C'était le vrai défaut : Word, PDF, texte — trois feuilles grises identiques dans une liste
    // de quarante lignes, donc aucune information.
    const found = ["a.docx", "b.xlsx", "c.pptx", "d.pdf"].map(fam);
    expect(found).toEqual(["word", "excel", "slides", "pdf"]);
  });

  it("archive, image, vidéo, audio sont quatre familles distinctes", () => {
    const found = ["a.zip", "b.png", "c.mp4", "d.mp3"].map(fam);
    expect(new Set(found).size).toBe(4);
  });

  it("le tableur l'emporte sur le texte pour un CSV", () => {
    // `csv` est du texte, mais on l'ouvre dans un tableur : c'est ce qu'il faut annoncer.
    expect(fam("ventes.csv")).toBe("excel");
  });

  it("un ZIP et un RAR partagent la famille mais pas l'étiquette", () => {
    // Ce sont deux archives — l'icône dira vrai. Mais on ne les ouvre pas avec le même outil,
    // et c'est l'étiquette qui le dit.
    expect(fam("x.rar")).toBe(fam("x.zip"));
    expect(badge("x.rar")).toBe("RAR");
    expect(badge("x.zip")).toBe("ZIP");
  });
});

describe("Les cas qui cassent une liste", () => {
  it("un dossier n'est pas un fichier, et se voit comme tel", () => {
    const f = fileGlyph("1.10 Meet", false);
    expect(f.family).toBe("folder");
    expect(f.badge).toBe("");
    // Un dossier nommé « 1.10 Meet » ne doit surtout pas passer pour un fichier « .10 MEET ».
    expect(fam("1.10 Meet")).not.toBe("folder");
  });

  it("un fichier sans extension ne porte pas d'étiquette", () => {
    expect(badge("LISEZMOI")).toBe("");
    expect(fam("LISEZMOI")).toBe("unknown");
  });

  it("un point final ne fabrique pas une extension vide", () => {
    expect(badge("rapport.")).toBe("");
  });

  it("un fichier caché n'est pas une extension", () => {
    expect(badge(".gitignore")).toBe("");
  });

  it("l'extension est lue sans se soucier de la casse", () => {
    expect(fileGlyph("RAPPORT.DOCX", true)).toEqual(fileGlyph("rapport.docx", true));
  });

  it("seule la DERNIÈRE extension compte", () => {
    expect(fam("archive.tar.gz")).toBe("archive");
    expect(badge("archive.tar.gz")).toBe("GZ");
  });

  it("une extension à rallonge ne déborde pas de la pastille", () => {
    expect(badge("modele.numbers")).toBe("");
    expect(fam("modele.numbers")).toBe("unknown");
  });

  it("un type inconnu s'assume au lieu de se déguiser", () => {
    expect(fam("plan.dwg")).toBe("cad"); // celui-là, on le connaît
    expect(fam("truc.qqq")).toBe("unknown");
    expect(badge("truc.qqq")).toBe("QQQ");
  });
});
