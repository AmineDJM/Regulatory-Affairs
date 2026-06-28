import { describe, it, expect } from "vitest";
import { blankOffice, isOfficeKind } from "./office-templates";

// Les noms de parties ne sont pas compressés dans un ZIP : on peut donc vérifier la
// structure OOXML directement sur le binaire, sans dépendance de décompression.
function contains(buf: Buffer, s: string): boolean {
  return buf.includes(Buffer.from(s, "utf8"));
}

describe("office-templates", () => {
  it("génère un .docx valide (ZIP + parties Word)", () => {
    const { data, ext, mime } = blankOffice("word");
    expect(ext).toBe("docx");
    expect(mime).toContain("wordprocessingml");
    expect(data.subarray(0, 2).toString()).toBe("PK"); // signature ZIP
    expect(data.subarray(data.length - 22).readUInt32LE(0)).toBe(0x06054b50); // EOCD
    expect(contains(data, "[Content_Types].xml")).toBe(true);
    expect(contains(data, "word/document.xml")).toBe(true);
  });

  it("génère un .xlsx valide (classeur + feuille)", () => {
    const { data, ext, mime } = blankOffice("cell");
    expect(ext).toBe("xlsx");
    expect(mime).toContain("spreadsheetml");
    expect(data.subarray(0, 2).toString()).toBe("PK");
    expect(contains(data, "xl/workbook.xml")).toBe(true);
    expect(contains(data, "xl/worksheets/sheet1.xml")).toBe(true);
  });

  it("génère un .pptx valide (présentation + masque + mise en page + diapo)", () => {
    const { data, ext, mime } = blankOffice("slide");
    expect(ext).toBe("pptx");
    expect(mime).toContain("presentationml");
    expect(data.subarray(0, 2).toString()).toBe("PK");
    for (const part of [
      "ppt/presentation.xml",
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/slides/slide1.xml",
      "ppt/theme/theme1.xml",
    ]) {
      expect(contains(data, part)).toBe(true);
    }
  });

  it("isOfficeKind ne reconnaît que word/cell/slide", () => {
    expect(isOfficeKind("word")).toBe(true);
    expect(isOfficeKind("cell")).toBe(true);
    expect(isOfficeKind("slide")).toBe(true);
    expect(isOfficeKind("pdf")).toBe(false);
    expect(isOfficeKind("")).toBe(false);
  });
});
