import PDFDocument from "pdfkit";
import { lireDocx, type ImageDocx } from "./docx-lecture";
import { composerDocument, numeroDePage, type PageComposee, type Trace } from "./docx-composition";
import { Polices } from "./polices";

/**
 * CONVERTIR UN DOCUMENT WORD EN PDF — sur le serveur, sans LibreOffice.
 *
 * ── CE QUE CETTE CONVERSION FAIT ────────────────────────────────────────────────────────────
 *
 * LibreOffice est absent de la cible de déploiement (Render, `runtime: node`) — §104 l'avait
 * mesuré. Quand l'éditeur Office du serveur est configuré, c'est LUI qui imprime
 * (`office-convert.ts`) ; ce module est le rendu de repli, et il doit tenir la comparaison.
 *
 * La première version relisait la structure et la redessinait « proprement » : la Direction l'a
 * jugée sur l'ordre de mission — le PDF ne reprenait que le texte. Les tabulations qui poussent la
 * date et le signataire à droite revenaient à gauche, les intertitres perdaient leur soulignement,
 * les tailles du document étaient ignorées (tout en 10 pt), les lignes ne tombaient pas où Word les
 * met. Ce module fait désormais une vraie MISE EN PAGE, en trois temps :
 *
 *   1. `docx-lecture.ts` relit le document comme Word l'interprète : cascade des styles, thème,
 *      tabulations, listes, champs, images et objets ancrés, tableaux, sections ;
 *   2. `docx-composition.ts` compose les pages : coupure des lignes avec les métriques de la police,
 *      tabulations, justification, espacements, pagination, en-têtes et pieds sur chaque page ;
 *   3. ici, on DESSINE les tracés avec pdfkit — polices embarquées quand le serveur les a
 *      (`polices.ts`), images PNG / JPEG (et les autres formats convertis), liens cliquables.
 *
 * Ce qui ne se restitue pas (notes de bas de page, graphiques, SmartArt, filigranes WordArt,
 * colonnes multiples, images EMF/WMF) est RENDU à l'appelant dans `limites` — dit, jamais tu.
 *
 * ── POURQUOI L'ORIGINAL EST CONSERVÉ ────────────────────────────────────────────────────────
 *
 * Un rendu, si fidèle soit-il, est une promesse que seul l'œil d'un humain peut vérifier. Le
 * `.docx` de départ reste donc attaché à la paie, invisible du salarié, ou rangé à côté de la
 * pièce : si le PDF trahit le document, la source est là sans avoir à la redemander.
 */

/** Résultat d'une conversion — jamais une exception jusqu'à l'appelant. */
export type PdfConversion =
  | { ok: true; pdf: Buffer; pages: number; limites?: string[] }
  | { ok: false; error: string };

export interface OptionsConversion {
  /** Chercher les polices du document (ou leurs jumelles métriques) sur le serveur. Vrai par défaut. */
  policesSysteme?: boolean;
}

type Doc = PDFKit.PDFDocument;
/** Une image déjà ouverte par pdfkit (`openImage`, absent de ses types) : réutilisée, elle n'est embarquée qu'une fois. */
type ImagePdf = { readonly width: number; readonly height: number };
const ouvrir = (doc: Doc, octets: Buffer): ImagePdf => (doc as unknown as { openImage(src: Buffer): ImagePdf }).openImage(octets);
const poserImage = (doc: Doc, im: ImagePdf, x: number, y: number, o: PDFKit.Mixins.ImageOption) => doc.image(im as unknown as Buffer, x, y, o);

const hex = (c: string) => `#${c}`;

/**
 * Les images du document, ouvertes UNE fois : pdfkit embarque alors chaque image une seule fois,
 * même répétée sur chaque page (le logo de l'en-tête). PNG et JPEG passent tels quels ; les autres
 * formats (GIF, TIFF, WebP, BMP…) sont convertis en PNG par `sharp` quand il sait les lire.
 */
async function ouvrirImages(doc: Doc, pages: PageComposee[], limites: Set<string>): Promise<Map<string, ImagePdf | null>> {
  const images = new Map<string, ImageDocx>();
  for (const p of pages) for (const t of [...p.derriere, ...p.bandes, ...p.corps, ...p.devant]) if (t.t === "image") images.set(t.image.cle, t.image);
  const out = new Map<string, ImagePdf | null>();
  for (const [cle, im] of images) {
    let ouverte: ImagePdf | null = null;
    try {
      ouverte = ouvrir(doc, im.octets);
    } catch {
      try {
        const sharp = (await import("sharp")).default;
        ouverte = ouvrir(doc, await sharp(im.octets).png().toBuffer());
      } catch {
        limites.add(/\.(emf|wmf)$/i.test(cle) ? "images vectorielles EMF/WMF" : "image dans un format illisible");
      }
    }
    out.set(cle, ouverte);
  }
  return out;
}

function dessinerTrace(doc: Doc, t: Trace, page: PageComposee, total: number, images: Map<string, ImagePdf | null>): void {
  switch (t.t) {
    case "texte": {
      const texte = t.champ ? (t.champ === "PAGE" ? numeroDePage(page.numero, page.formatNumero) : String(total)) : t.texte;
      if (!texte) return;
      const options: PDFKit.Mixins.TextOptions & { horizontalScaling?: number; baseline?: string } = { lineBreak: false, baseline: "alphabetic" };
      if (t.police.echelle !== 1) options.horizontalScaling = t.police.echelle * 100;
      if (t.espacement) options.characterSpacing = t.espacement / t.police.echelle;
      if (t.police.faux.italique) options.oblique = 12;
      doc.save();
      doc.font(t.police.cle).fontSize(t.taille).fillColor(hex(t.couleur));
      if (t.police.faux.gras) {
        doc.lineWidth(t.taille * 0.035).strokeColor(hex(t.couleur));
        options.fill = true;
        options.stroke = true;
      }
      doc.text(texte, t.x, t.y, options);
      doc.restore();
      return;
    }
    case "image": {
      const im = images.get(t.image.cle);
      if (!im || t.largeur <= 0 || t.hauteur <= 0) return;
      const r = t.rognage;
      if (r && 1 - r.gauche - r.droite > 0.01 && 1 - r.haut - r.bas > 0.01) {
        const lw = t.largeur / (1 - r.gauche - r.droite);
        const lh = t.hauteur / (1 - r.haut - r.bas);
        doc.save();
        doc.rect(t.x, t.y, t.largeur, t.hauteur).clip();
        poserImage(doc, im, t.x - r.gauche * lw, t.y - r.haut * lh, { width: lw, height: lh });
        doc.restore();
      } else {
        poserImage(doc, im, t.x, t.y, { width: t.largeur, height: t.hauteur });
      }
      return;
    }
    case "rect": {
      if (t.largeur <= 0 || t.hauteur <= 0) return;
      doc.save();
      if (t.forme === "ellipse") doc.ellipse(t.x + t.largeur / 2, t.y + t.hauteur / 2, t.largeur / 2, t.hauteur / 2);
      else if (t.forme === "roundRect") doc.roundedRect(t.x, t.y, t.largeur, t.hauteur, Math.min(t.largeur, t.hauteur) * 0.1667);
      else doc.rect(t.x, t.y, t.largeur, t.hauteur);
      if (t.fond && t.trait) doc.lineWidth(t.trait.epaisseur).fillAndStroke(hex(t.fond), hex(t.trait.couleur));
      else if (t.fond) doc.fill(hex(t.fond));
      else if (t.trait) doc.lineWidth(t.trait.epaisseur).stroke(hex(t.trait.couleur));
      doc.restore();
      return;
    }
    case "ligne": {
      const trait = (dx: number, dy: number, ep: number) => {
        doc.save();
        doc.lineWidth(ep).strokeColor(hex(t.couleur)).lineCap(t.style === "pointille" ? "round" : "butt");
        if (t.style === "pointille") doc.dash(0.01, { space: ep * 2 });
        else if (t.style === "tirets") doc.dash(ep * 3, { space: ep * 2 });
        doc.moveTo(t.x1 + dx, t.y1 + dy).lineTo(t.x2 + dx, t.y2 + dy).stroke();
        doc.restore();
      };
      if (t.style === "double") {
        const ep = Math.max(0.25, t.epaisseur / 3);
        const vertical = Math.abs(t.x1 - t.x2) < Math.abs(t.y1 - t.y2);
        trait(vertical ? -ep : 0, vertical ? 0 : -ep, ep);
        trait(vertical ? ep : 0, vertical ? 0 : ep, ep);
      } else trait(0, 0, t.epaisseur);
      return;
    }
    case "puce": {
      const s = t.taille;
      doc.save().fillColor(hex(t.couleur)).strokeColor(hex(t.couleur));
      if (t.forme === "disque") doc.circle(t.x, t.y, s * 0.16).fill();
      else if (t.forme === "cercle") doc.lineWidth(s * 0.06).circle(t.x, t.y, s * 0.15).stroke();
      else if (t.forme === "carre") doc.rect(t.x - s * 0.14, t.y - s * 0.14, s * 0.28, s * 0.28).fill();
      else if (t.forme === "losange") doc.polygon([t.x, t.y - s * 0.2], [t.x + s * 0.2, t.y], [t.x, t.y + s * 0.2], [t.x - s * 0.2, t.y]).fill();
      else doc.polygon([t.x - s * 0.15, t.y - s * 0.2], [t.x + s * 0.2, t.y], [t.x - s * 0.15, t.y + s * 0.2]).fill();
      doc.restore();
      return;
    }
    case "lien":
      if (/^(https?:|mailto:)/i.test(t.url)) doc.link(t.x, t.y, t.largeur, t.hauteur, t.url);
      return;
  }
}

/**
 * LES OCTETS D'UN `.docx` → LES OCTETS D'UN PDF.
 *
 * Ne lève jamais : un bulletin illisible ne doit pas faire échouer la PAIE. L'appelant reçoit un
 * échec explicite et garde alors le fichier d'origine — payer un salarié passe avant le format
 * de son bulletin.
 */
export async function docxToPdf(bytes: Buffer | Uint8Array, options: OptionsConversion = {}): Promise<PdfConversion> {
  try {
    const lu = lireDocx(bytes);
    if (lu.sections.every((s) => s.blocs.length === 0)) return { ok: false, error: "Le document Word est vide." };

    const premiere = lu.sections[0]!.section;
    const doc = new PDFDocument({ size: [premiere.largeur, premiere.hauteur], margin: 0, autoFirstPage: false, compress: true, info: { Producer: "AMD Internal OS", Creator: "AMD Internal OS" } });
    const morceaux: Buffer[] = [];
    doc.on("data", (c: Buffer) => morceaux.push(c));
    const fini = new Promise<void>((resolve, reject) => {
      doc.on("end", () => resolve());
      doc.on("error", reject);
    });

    const polices = new Polices(doc, options.policesSysteme ?? true);
    const pages = composerDocument(lu, polices);
    const limites = new Set<string>(lu.ignores);
    if (lu.sections.some((s) => s.section.colonnes > 1)) limites.add("colonnes multiples (rendues sur une colonne)");
    const images = await ouvrirImages(doc, pages, limites);

    for (const page of pages) {
      doc.addPage({ size: [page.largeur, page.hauteur], margin: 0 });
      for (const t of page.derriere) dessinerTrace(doc, t, page, pages.length, images);
      for (const t of page.bandes) dessinerTrace(doc, t, page, pages.length, images);
      for (const t of page.corps) dessinerTrace(doc, t, page, pages.length, images);
      for (const t of page.devant) dessinerTrace(doc, t, page, pages.length, images);
    }
    if (polices.substituees.size > 0) limites.add(`polices remplacées par une police standard de même chasse : ${[...polices.substituees].join(", ")}`);
    doc.end();
    await fini;

    return { ok: true, pdf: Buffer.concat(morceaux), pages: pages.length, limites: [...limites] };
  } catch (err) {
    console.error("[payslip] conversion docx → pdf impossible", err);
    return { ok: false, error: "Ce fichier Word n'a pas pu être converti en PDF." };
  }
}

/** Le nom du PDF produit : le même, avec la bonne extension. */
export function pdfFileName(original: string): string {
  return `${original.replace(/\.[^.]+$/, "")}.pdf`;
}

/** Est-ce un document Word que l'on sait convertir ? (Le `.doc` ancien format ne l'est pas.) */
export function isConvertibleWord(name: string, mime: string | null | undefined): boolean {
  if (/\.docx$/i.test(name)) return true;
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
