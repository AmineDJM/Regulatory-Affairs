import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { factKeysOf, type TemplateDef } from "./templates";

/**
 * Construit un .docx RÉEL à partir d'un template versionné et d'un dictionnaire de données
 * (issu du jumeau numérique APPROUVÉ). Les espaces réservés non renseignés deviennent un
 * marqueur explicite « [À COMPLÉTER] » — jamais une valeur inventée. Retourne le buffer + le
 * décompte des faits utilisés/manquants (traçabilité).
 */

export const MISSING_MARKER = "[À COMPLÉTER]";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function paragraph(text: string, opts: { bold?: boolean; size?: number } = {}): string {
  const rpr = [opts.bold ? "<w:b/>" : "", opts.size ? `<w:sz w:val="${opts.size}"/>` : ""].join("");
  // Le texte contient des placeholders {KEY} (A-Z_) — sûrs ; on échappe seulement &<>.
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function documentXml(template: TemplateDef): string {
  const parts: string[] = [paragraph(template.title, { bold: true, size: 32 })];
  for (const block of template.blocks) {
    if (block.heading) parts.push(paragraph(block.heading, { bold: true, size: 26 }));
    for (const line of block.lines) parts.push(paragraph(line, { size: 22 }));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${parts.join("")}<w:sectPr/></w:body></w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

export interface RenderResult {
  buffer: Buffer;
  used: string[];
  missing: string[];
}

/**
 * Rend le template avec `data`. Toute clé de fait référencée absente/vide → marqueur explicite.
 * Les placeholders méta (DATE, DOSSIER_REF…) doivent être fournis dans `data`.
 */
export function renderTemplate(template: TemplateDef, data: Record<string, string>): RenderResult {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels")!.file(".rels", RELS);
  zip.folder("word")!.file("document.xml", documentXml(template));

  const factKeys = factKeysOf(template);
  const used: string[] = [];
  const missing: string[] = [];
  const full: Record<string, string> = { ...data };
  for (const k of factKeys) {
    const v = (data[k] ?? "").trim();
    if (v) used.push(k);
    else { missing.push(k); full[k] = MISSING_MARKER; }
  }

  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, nullGetter: () => MISSING_MARKER });
  doc.render(full);
  const buffer = doc.getZip().generate({ type: "nodebuffer" }) as Buffer;
  return { buffer, used, missing };
}
