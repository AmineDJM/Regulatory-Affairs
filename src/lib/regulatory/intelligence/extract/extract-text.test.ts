import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { extractText, pdfTextHint } from "./extract-text";

async function makeDocx(text: string): Promise<Buffer> {
  const z = new JSZip();
  z.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.folder("_rels")!.file(".rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.folder("word")!.file("document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return z.generateAsync({ type: "nodebuffer" });
}

function makeXlsx(rows: string[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Feuille1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("extractText — extraction de texte par type", () => {
  it("texte brut (txt/csv/xml)", async () => {
    const r = await extractText("txt", Buffer.from("Rapport de stabilité ANPP"));
    expect(r.status).toBe("TEXT_EXTRACTED");
    expect(r.method).toBe("plain");
    expect(r.text).toContain("stabilité");
  });

  it("DOCX (mammoth) → texte du document", async () => {
    const r = await extractText("docx", await makeDocx("Formulaire de pré-soumission"));
    expect(r.status).toBe("TEXT_EXTRACTED");
    expect(r.method).toBe("docx");
    expect(r.text).toContain("pré-soumission");
  });

  it("XLSX → contenu des cellules en CSV", async () => {
    const r = await extractText("xlsx", makeXlsx([["Produit", "DCI"], ["Amox 500", "Amoxicilline"]]));
    expect(r.status).toBe("TEXT_EXTRACTED");
    expect(r.method).toBe("xlsx");
    expect(r.text).toContain("Amoxicilline");
  });

  it("image → OCR requis (pas d'invention)", async () => {
    const r = await extractText("png", Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(r.status).toBe("OCR_REQUIRED");
  });

  it("format binaire non pris en charge (doc hérité) → UNSUPPORTED", async () => {
    const r = await extractText("doc", Buffer.from([0xd0, 0xcf, 0x11, 0xe0]));
    expect(r.status).toBe("UNSUPPORTED");
  });

  it("PDF scan (image seule) → OCR requis", async () => {
    const scan = Buffer.from("%PDF-1.4\n/XObject /Subtype /Image /DCTDecode stream ...", "latin1");
    const r = await extractText("pdf", scan);
    expect(r.status).toBe("OCR_REQUIRED");
    expect(r.method).toBe("pdf-scan");
  });
});

describe("pdfTextHint — détection de couche texte", () => {
  it("détecte une couche texte (opérateurs Tj/Font)", () => {
    expect(pdfTextHint(Buffer.from("%PDF-1.4 /Font BT (Bonjour) Tj ET", "latin1"))).toBe("text");
  });
  it("détecte un scan (image, sans texte)", () => {
    expect(pdfTextHint(Buffer.from("%PDF-1.4 /XObject /Subtype /Image /DCTDecode", "latin1"))).toBe("scan");
  });
});
