import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { renderTemplate, MISSING_MARKER } from "./build-docx";
import { DOC_TEMPLATES, templateByCode, factKeysOf } from "./templates";

const docText = (buffer: Buffer) => new PizZip(buffer).file("word/document.xml")!.asText();

describe("templates (G10)", () => {
  it("expose des templates versionnés à codes uniques", () => {
    expect(DOC_TEMPLATES.length).toBeGreaterThanOrEqual(10);
    const codes = new Set(DOC_TEMPLATES.map((t) => t.code));
    expect(codes.size).toBe(DOC_TEMPLATES.length);
    for (const t of DOC_TEMPLATES) expect(t.version).toMatch(/\d/);
  });

  it("factKeysOf extrait les clés de faits (hors placeholders méta)", () => {
    const keys = factKeysOf(templateByCode("PRESUBMISSION_NOTE")!);
    expect(keys).toContain("PRODUCT_NAME");
    expect(keys).toContain("INN");
    expect(keys).not.toContain("DATE"); // méta
    expect(keys).not.toContain("PROCEDURE"); // méta
  });
});

describe("renderTemplate — génération docx réelle", () => {
  it("produit un docx valide avec les valeurs fournies", () => {
    const t = templateByCode("PRESUBMISSION_NOTE")!;
    const r = renderTemplate(t, { PRODUCT_NAME: "Amoxival 500", INN: "Amoxicilline", DATE: "01/01/2026", DOSSIER_REF: "REG-1", PROCEDURE: "Enregistrement initial" });
    const xml = docText(r.buffer);
    expect(xml).toContain("Amoxival 500");
    expect(xml).toContain("Amoxicilline");
    expect(r.used).toContain("PRODUCT_NAME");
    expect(r.used).toContain("INN");
  });

  it("insère le marqueur « [À COMPLÉTER] » pour les données non fournies (jamais d'invention)", () => {
    const t = templateByCode("REGISTRATION_FORM")!;
    const r = renderTemplate(t, { PRODUCT_NAME: "X", DATE: "01/01/2026", DOSSIER_REF: "R", PROCEDURE: "P" });
    const xml = docText(r.buffer);
    expect(xml).toContain(MISSING_MARKER); // dosage, fabricant… manquants
    expect(r.missing).toContain("INN");
    expect(r.missing).toContain("MANUFACTURER");
    expect(r.used).toContain("PRODUCT_NAME");
  });

  it("échappe les caractères XML des valeurs (robustesse)", () => {
    const t = templateByCode("COVER_LETTER")!;
    const r = renderTemplate(t, { PRODUCT_NAME: "A & B <test>", INN: "x", STRENGTH: "1 g", DATE: "01/01/2026", DOSSIER_REF: "R", PROCEDURE: "P" });
    // Le docx reste ouvrable (XML valide) malgré les caractères spéciaux.
    expect(() => docText(r.buffer)).not.toThrow();
    expect(docText(r.buffer)).toContain("A &amp; B");
  });
});
