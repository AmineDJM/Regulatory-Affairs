/**
 * GÉNÉRATEUR PDF MAISON — des PDF PROPRES sans aucune dépendance.
 *
 * Le besoin : l'agent de dossier produit des livrables (note de synthèse, projet de réponse aux
 * réserves) que l'on veut télécharger en PDF net — pas un export brut. Aucune bibliothèque PDF
 * n'est installée, et en embarquer une (navigateur headless, moteur de rendu) coûterait plus que
 * le besoin : du TEXTE STRUCTURÉ soigné — titre, intertitres, paragraphes, puces, pieds de page.
 *
 * Choix techniques, tous au service de la simplicité vérifiable :
 *   • polices BASE-14 (Helvetica / Helvetica-Bold) : aucun embarquement, rendu identique partout ;
 *   • encodage WinAnsi : couvre le français (é è à ç ï ô …) — les caractères hors Latin-1 sont
 *     remplacés par « ? » plutôt que de corrompre le flux ;
 *   • césure au MOT près avec les largeurs RÉELLES de la police (table AFM Helvetica) — c'est ce
 *     qui distingue un rendu propre d'un texte qui déborde ;
 *   • A4, marges généreuses, pagination « n / N » en pied de page.
 *
 * PUR : octets en entrée/sortie, aucun accès disque ni base — donc testable.
 */

export interface PdfBlock {
  type: "title" | "heading" | "paragraph" | "bullet";
  text: string;
}

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 56;
const CONTENT_W = A4.w - MARGIN * 2;

// Largeurs Helvetica (AFM), en millièmes de corps, pour les caractères 32..126. Les accentués
// héritent de leur lettre de base — l'écart réel est négligeable pour la césure.
const HELV_WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BASE_OF: Record<string, string> = {
  "à": "a", "â": "a", "ä": "a", "é": "e", "è": "e", "ê": "e", "ë": "e", "î": "i", "ï": "i",
  "ô": "o", "ö": "o", "ù": "u", "û": "u", "ü": "u", "ç": "c", "œ": "o",
  "À": "A", "Â": "A", "Ä": "A", "É": "E", "È": "E", "Ê": "E", "Ë": "E", "Î": "I", "Ï": "I",
  "Ô": "O", "Ö": "O", "Ù": "U", "Û": "U", "Ü": "U", "Ç": "C", "’": "'", "«": '"', "»": '"',
  "–": "-", "—": "-", "…": ".",
};

function charWidth(ch: string, size: number, bold: boolean): number {
  const base = BASE_OF[ch] ?? ch;
  const code = base.charCodeAt(0);
  const w = code >= 32 && code <= 126 ? HELV_WIDTHS[code - 32] : 556;
  // Le gras est légèrement plus large ; surestimer de 6 % garantit qu'une ligne ne déborde jamais.
  return ((w * (bold ? 1.06 : 1)) / 1000) * size;
}

function textWidth(text: string, size: number, bold: boolean): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, size, bold);
  return w;
}

/** Coupe un texte en lignes tenant dans `maxW` points, au mot près (jamais au milieu d'un mot). */
export function wrapText(text: string, size: number, maxW: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size, bold) <= maxW || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

// WinAnsi ≈ Latin-1 pour le français. Hors plage → « ? » (jamais d'octet invalide dans le flux).
function toWinAnsi(text: string): Buffer {
  const out = Buffer.alloc([...text].length);
  let i = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    const mapped = cp <= 0xff ? cp : (BASE_OF[ch] ? BASE_OF[ch].charCodeAt(0) : 63);
    out[i++] = mapped <= 0xff ? mapped : 63;
  }
  return out.subarray(0, i);
}

function esc(text: string): Buffer {
  const raw = toWinAnsi(text);
  const parts: number[] = [];
  for (const b of raw) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) parts.push(0x5c); // ( ) \ échappés
    parts.push(b);
  }
  return Buffer.from(parts);
}

interface Line { text: string; x: number; y: number; size: number; bold: boolean; gray?: number }

/**
 * Interprète un CONTENU TEXTE structuré par lignes en blocs :
 *   « # Intertitre » → heading ; « - … » ou « • … » → puce ; ligne vide → séparation ; sinon → paragraphe.
 * C'est le format que l'agent écrit naturellement — aucun balisage exotique à apprendre.
 */
export function parsePdfBody(body: string): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  for (const rawLine of (body ?? "").replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^#{1,3}\s+/.test(line)) blocks.push({ type: "heading", text: line.replace(/^#{1,3}\s+/, "") });
    else if (/^[-•*]\s+/.test(line)) blocks.push({ type: "bullet", text: line.replace(/^[-•*]\s+/, "") });
    else blocks.push({ type: "paragraph", text: line });
  }
  return blocks;
}

/** Construit le PDF : titre + blocs, pagination, pied de page. Rendu déterministe. */
export function buildSimplePdf(title: string, blocks: PdfBlock[], opts: { footer?: string } = {}): Buffer {
  const SIZES = { title: 18, heading: 12.5, paragraph: 10.5, bullet: 10.5 };
  const LEADING = { title: 24, heading: 18, paragraph: 15, bullet: 15 };
  const footerText = opts.footer ?? "";

  // 1) MISE EN PAGE : découpe des blocs en lignes positionnées, page par page.
  const pages: Line[][] = [[]];
  let y = A4.h - MARGIN;
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 24) { pages.push([]); y = A4.h - MARGIN; }
  };
  const put = (text: string, x: number, size: number, bold: boolean, leading: number, gray?: number) => {
    ensure(leading);
    y -= leading;
    pages[pages.length - 1].push({ text, x, y, size, bold, gray });
  };

  for (const line of wrapText(title, SIZES.title, CONTENT_W, true)) put(line, MARGIN, SIZES.title, true, LEADING.title);
  y -= 10;

  for (const b of blocks) {
    if (b.type === "title") {
      y -= 6;
      for (const line of wrapText(b.text, SIZES.title, CONTENT_W, true)) put(line, MARGIN, SIZES.title, true, LEADING.title);
      y -= 4;
    } else if (b.type === "heading") {
      y -= 8; // aération avant un intertitre : c'est elle qui structure la page
      for (const line of wrapText(b.text, SIZES.heading, CONTENT_W, true)) put(line, MARGIN, SIZES.heading, true, LEADING.heading);
      y -= 2;
    } else if (b.type === "bullet") {
      const lines = wrapText(b.text, SIZES.bullet, CONTENT_W - 14, false);
      lines.forEach((line, i) => {
        if (i === 0) {
          ensure(LEADING.bullet);
          y -= LEADING.bullet;
          pages[pages.length - 1].push({ text: "•", x: MARGIN, y, size: SIZES.bullet, bold: false });
          pages[pages.length - 1].push({ text: line, x: MARGIN + 14, y, size: SIZES.bullet, bold: false });
        } else put(line, MARGIN + 14, SIZES.bullet, false, LEADING.bullet);
      });
    } else {
      for (const line of wrapText(b.text, SIZES.paragraph, CONTENT_W, false)) put(line, MARGIN, SIZES.paragraph, false, LEADING.paragraph);
      y -= 4; // respiration entre paragraphes
    }
  }

  // Pieds de page : « n / N » à droite, mention à gauche — sur CHAQUE page.
  const total = pages.length;
  pages.forEach((page, i) => {
    const num = `${i + 1} / ${total}`;
    page.push({ text: num, x: A4.w - MARGIN - textWidth(num, 8.5, false), y: MARGIN - 26, size: 8.5, bold: false, gray: 0.45 });
    if (footerText) page.push({ text: footerText, x: MARGIN, y: MARGIN - 26, size: 8.5, bold: false, gray: 0.45 });
  });

  // 2) SÉRIALISATION PDF : objets numérotés + table xref exacte.
  const objects: Buffer[] = [];
  const addObj = (body: Buffer | string): number => {
    objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1"));
    return objects.length; // ids 1..n
  };

  const fontRegular = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (const page of pages) {
    const parts: Buffer[] = [];
    for (const l of page) {
      const gray = l.gray != null ? `${l.gray.toFixed(2)} g ` : "0 g ";
      parts.push(Buffer.from(`BT ${gray}/${l.bold ? "F2" : "F1"} ${l.size} Tf 1 0 0 1 ${l.x.toFixed(2)} ${l.y.toFixed(2)} Tm (`, "latin1"));
      parts.push(esc(l.text));
      parts.push(Buffer.from(") Tj ET\n", "latin1"));
    }
    const stream = Buffer.concat(parts);
    contentIds.push(addObj(Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream", "latin1"),
    ])));
  }

  const pagesId = objects.length + pages.length + 2; // réservé après les pages + catalog
  for (const cid of contentIds) {
    pageIds.push(addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] ` +
      `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${cid} 0 R >>`,
    ));
  }
  const catalogId = addObj(""); // provisoire — rempli ci-dessous une fois pagesId connu
  const realPagesId = addObj(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  objects[catalogId - 1] = Buffer.from(`<< /Type /Catalog /Pages ${realPagesId} 0 R >>`, "latin1");
  // Les pages référencent `pagesId` calculé d'avance : il doit correspondre au vrai.
  if (realPagesId !== pagesId) {
    for (let i = 0; i < pageIds.length; i++) {
      objects[pageIds[i] - 1] = Buffer.from(
        objects[pageIds[i] - 1].toString("latin1").replace(`/Parent ${pagesId} 0 R`, `/Parent ${realPagesId} 0 R`), "latin1",
      );
    }
  }

  const head = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1");
  const chunks: Buffer[] = [head];
  const offsets: number[] = [];
  let pos = head.length;
  objects.forEach((body, i) => {
    offsets.push(pos);
    const obj = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    chunks.push(obj);
    pos += obj.length;
  });
  const xrefPos = pos;
  const xref = [
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`,
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`,
  ].join("");
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}
