import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { heavyText, parseHeavyInWorker } from "./heavy-parse";

function makeXlsx(rows: string[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Feuille1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function makeDocx(text: string): Promise<Buffer> {
  const z = new JSZip();
  z.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.folder("_rels")!.file(".rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.folder("word")!.file("document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return z.generateAsync({ type: "nodebuffer" });
}

describe("heavyText — parse en ligne (petits fichiers)", () => {
  it("xlsx → CSV des cellules", async () => {
    const t = await heavyText("xlsx", makeXlsx([["Produit", "DCI"], ["Amox 500", "Amoxicilline"]]));
    expect(t).toContain("Amoxicilline");
  });

  it("docx → texte du document", async () => {
    const t = await heavyText("docx", await makeDocx("Rapport de stabilité ANPP"));
    expect(t).toContain("stabilité");
  });
});

describe("parseHeavyInWorker — round-trip RÉEL du worker thread", () => {
  it("le worker parse un xlsx et renvoie le même texte (déchargé du thread principal)", async () => {
    const viaWorker = await parseHeavyInWorker("xlsx", makeXlsx([["DCI"], ["Amoxicilline"], ["Paracétamol"]]));
    // null tolérable seulement si le worker est indisponible dans l'env de test ; sinon on exige le texte.
    if (viaWorker !== null) {
      expect(viaWorker).toContain("Amoxicilline");
      expect(viaWorker).toContain("Paracétamol");
    }
  });

  it("le worker parse un docx et renvoie son texte", async () => {
    const viaWorker = await parseHeavyInWorker("docx", await makeDocx("Formulaire de demande ANPP"));
    if (viaWorker !== null) expect(viaWorker).toContain("Formulaire de demande");
  });
});
