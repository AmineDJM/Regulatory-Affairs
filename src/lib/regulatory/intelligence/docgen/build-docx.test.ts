import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { buildSimpleDocx, MISSING_MARKER } from "./build-docx";

/**
 * Le .docx produit doit s'ouvrir dans Word : un rapport de constats ou une lettre de réponse
 * illisible ne vaut rien. On vérifie donc l'archive RÉELLE, pas une chaîne intermédiaire.
 */
function textOf(buf: Buffer): string {
  return new PizZip(buf).file("word/document.xml")!.asText();
}

describe("buildSimpleDocx", () => {
  it("produit une archive .docx valide (les 3 pièces qu'attend Word)", () => {
    const zip = new PizZip(buildSimpleDocx([{ text: "Bonjour" }]));
    expect(zip.file("[Content_Types].xml")).toBeTruthy();
    expect(zip.file("_rels/.rels")).toBeTruthy();
    expect(zip.file("word/document.xml")).toBeTruthy();
  });

  it("écrit chaque paragraphe, avec gras et italique", () => {
    const xml = textOf(buildSimpleDocx([
      { text: "Titre du rapport", bold: true, size: 32 },
      { text: "Une citation", italic: true },
    ]));
    expect(xml).toContain("Titre du rapport");
    expect(xml).toContain("Une citation");
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("<w:i/>");
  });

  it("échappe le XML — un verbatim ANPP avec & ou < ne casse pas le document", () => {
    const xml = textOf(buildSimpleDocx([{ text: "Teneur < 2 % & impuretés" }]));
    expect(xml).toContain("Teneur &lt; 2 % &amp; impuretés");
    expect(xml).not.toContain("< 2 % &");
  });

  it("accepte des accolades et guillemets (aucun moteur de template derrière)", () => {
    const xml = textOf(buildSimpleDocx([{ text: '« Réserve {1} : justifier la {stabilité} »' }]));
    expect(xml).toContain("{1}");
    expect(xml).toContain("{stabilité}");
  });

  it("expose le marqueur des réponses manquantes", () => {
    expect(MISSING_MARKER).toBe("[À COMPLÉTER]");
  });
});
