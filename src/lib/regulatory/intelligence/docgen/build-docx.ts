import PizZip from "pizzip";

/**
 * FABRIQUE DE .docx — minimale et sans dépendance de rendu.
 *
 * Un seul usage subsiste, et c'est le bon : composer en code les documents dont la STRUCTURE
 * dépend des données — le rapport de constats et la lettre de réponse aux réserves. La
 * génération à partir de modèles à trous (note de pré-soumission, formulaire d'enregistrement)
 * a été retirée : elle produisait des coquilles à recopier à la main plutôt que du travail
 * réellement fait, et encombrait l'écran d'analyse.
 *
 * Le marqueur « [À COMPLÉTER] » reste : dans une lettre de réponse, une réponse absente doit
 * SAUTER AUX YEUX plutôt que d'être comblée par une invention.
 */

export const MISSING_MARKER = "[À COMPLÉTER]";

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function paragraph(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}): string {
  const rpr = [opts.bold ? "<w:b/>" : "", opts.italic ? "<w:i/>" : "", opts.size ? `<w:sz w:val="${opts.size}"/>` : ""].join("");
  return `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr>${rpr}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

/** Paragraphe « libre » pour les documents composés en code (rapports, lettres de réponse). */
export interface SimplePara {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Demi-points Word (32 = 16 pt). Défaut : 22 (11 pt). */
  size?: number;
}

/**
 * Construit un .docx à partir de paragraphes DÉJÀ composés — aucun moteur de template, donc le
 * contenu peut contenir des accolades, des guillemets ou du verbatim ANPP sans risque.
 */
export function buildSimpleDocx(paras: SimplePara[]): Buffer {
  const body = paras.map((p) => paragraph(p.text, { bold: p.bold, italic: p.italic, size: p.size ?? 22 })).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.folder("_rels")!.file(".rels", RELS);
  zip.folder("word")!.file("document.xml", xml);
  return zip.generate({ type: "nodebuffer" }) as Buffer;
}
