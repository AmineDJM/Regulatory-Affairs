/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * LE CORPUS D'ESSAI — de VRAIS fichiers, pour mesurer autre chose qu'une intention.
 *
 * ── CE QUE CE CORPUS EST, ET CE QU'IL N'EST PAS ──────────────────────────────────────────
 *
 * Ce sont de vrais binaires : un PDF avec sa couche texte, un PDF image-seule, une photo, un
 * classeur, une présentation, un document Word, des courriels. Ils traversent exactement les
 * mêmes parseurs que les fichiers d'Adventum, et c'est la seule raison d'être de ce fichier :
 * on ne peut pas mesurer une chaîne d'ingestion sans lui donner à manger.
 *
 * Ce n'est PAS le fonds documentaire d'Adventum. Le contenu est écrit ici, donc il mesure la
 * MÉCANIQUE — sait-on extraire, dédupliquer, versionner, indexer, retrouver ? — et pas la
 * qualité de compréhension sur les vrais courriers de l'entreprise. Les deux chiffres ne se
 * confondent pas, et l'audit doit dire lequel il rapporte.
 *
 * Tout est marqué « ESSAI » et référencé en `ESS-…` : une capture d'écran de ce corpus ne doit
 * jamais pouvoir passer pour un état réel de l'entreprise.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Échappe le texte pour un flux de contenu PDF (parenthèses et antislash sont syntaxiques). */
const pdfEsc = (s: string): string => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/**
 * UN PDF AVEC UNE VRAIE COUCHE TEXTE, écrit à la main.
 *
 * Aucune bibliothèque de génération n'est installée ici, et le format s'y prête : un PDF est un
 * fichier texte avec une table d'offsets. L'écrire soi-même garantit surtout une chose utile au
 * banc — on sait EXACTEMENT quel texte doit ressortir, donc on peut vérifier l'extraction au
 * lieu de la croire.
 */
export function makeTextPdf(pages: string[][]): Buffer {
  const objs: string[] = [];
  const pageIds: number[] = [];
  // 1 = catalogue, 2 = arbre de pages, 3 = police ; les pages commencent à 4.
  let next = 4;

  const contentIds: number[] = [];
  for (const lines of pages) {
    const body = lines
      .map((l, i) => `BT /F1 11 Tf 56 ${760 - i * 16} Td (${pdfEsc(l)}) Tj ET`)
      .join("\n");
    const cid = next++;
    contentIds.push(cid);
    objs[cid] = `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`;
  }
  for (let i = 0; i < pages.length; i++) {
    const pid = next++;
    pageIds.push(pid);
    objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
  }

  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;

  return assemblePdf(objs, next);
}

/**
 * UN PDF IMAGE-SEULE — le cas du scan, celui qui n'a AUCUN texte à extraire.
 *
 * C'est le document qui doit déclencher la vision, et donc le seul qui prouve que le routage
 * fait son travail : si le banc trouvait du texte ici, c'est que le fichier ne serait pas un
 * scan et que la mesure ne vaudrait rien.
 */
export function makeScannedPdf(jpeg: Buffer, width: number, height: number): Buffer {
  const objs: string[] = [];
  const body = `q ${width} 0 0 ${height} 0 ${842 - height} cm /Im0 Do Q`;
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [4 0 R] /Count 1 >>`;
  // `DCTDecode` = du JPEG, inséré TEL QUEL dans le flux. C'est le seul format d'image qu'un PDF
  // accepte sans ré-encodage : un PNG demanderait de le décompresser puis de le ré-compresser en
  // Flate, ce qui ajouterait un bogue possible entre le banc et ce qu'il prétend mesurer.
  objs[3] = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n@@IMG@@\nendstream`;
  objs[4] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 3 0 R >> >> /Contents 5 0 R >>`;
  objs[5] = `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`;
  return assemblePdf(objs, 6, jpeg);
}

/** Assemble les objets, la table d'offsets et la queue. C'est la partie mécanique du format. */
function assemblePdf(objs: string[], next: number, raw?: Buffer): Buffer {
  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  const offsets: number[] = [];
  let pos = parts[0].length;

  for (let i = 1; i < next; i++) {
    if (!objs[i]) { offsets[i] = 0; continue; }
    offsets[i] = pos;
    const [head, tail] = objs[i].includes("@@IMG@@") ? objs[i].split("@@IMG@@") : [objs[i], null];
    const chunk = tail !== null && raw
      ? Buffer.concat([
        Buffer.from(`${i} 0 obj\n${head}`, "latin1"),
        raw,
        Buffer.from(`${tail}\nendobj\n`, "latin1"),
      ])
      : Buffer.from(`${i} 0 obj\n${objs[i]}\nendobj\n`, "latin1");
    parts.push(chunk);
    pos += chunk.length;
  }

  const xrefAt = pos;
  let xref = `xref\n0 ${next}\n0000000000 65535 f \n`;
  for (let i = 1; i < next; i++) xref += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${next} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}

/** Un courriel au format RFC 822 — ce que l'ingestion reçoit vraiment d'une boîte. */
export function makeEml(o: {
  de: string; a: string; objet: string; date: string; corps: string; piece?: { nom: string; contenu: string };
}): Buffer {
  if (!o.piece) {
    return Buffer.from(
      `From: ${o.de}\r\nTo: ${o.a}\r\nSubject: ${o.objet}\r\nDate: ${o.date}\r\n`
      + `Content-Type: text/plain; charset=utf-8\r\n\r\n${o.corps}\r\n`,
      "utf8",
    );
  }
  const b = "----=_ESSAI_LIMITE";
  return Buffer.from(
    `From: ${o.de}\r\nTo: ${o.a}\r\nSubject: ${o.objet}\r\nDate: ${o.date}\r\n`
    + `Content-Type: multipart/mixed; boundary="${b}"\r\n\r\n`
    + `--${b}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${o.corps}\r\n`
    + `--${b}\r\nContent-Type: text/plain; name="${o.piece.nom}"\r\n`
    + `Content-Disposition: attachment; filename="${o.piece.nom}"\r\n\r\n${o.piece.contenu}\r\n`
    + `--${b}--\r\n`,
    "utf8",
  );
}

/**
 * UN .docx RÉEL — via la fabrique déjà utilisée par le module Regulatory pour ses rapports.
 *
 * Réutilisée plutôt que réécrite : c'est le même paquet OOXML que `mammoth` lit en production.
 * En fabriquer un second ici n'aurait mesuré que l'accord de deux écritures maison.
 */
export async function makeDocx(paras: { text: string; bold?: boolean }[]): Promise<Buffer> {
  const { buildSimpleDocx } = await import("../../src/lib/regulatory/intelligence/docgen/build-docx");
  return zipReproductible(buildSimpleDocx(paras));
}

/**
 * UN CLASSEUR .xlsx RÉEL, produit par `xlsx` — la même bibliothèque que celle qui le relira.
 *
 * Le banc doit vérifier qu'une LIGNE reste une ligne : après aplatissement, « 4 500 » n'est plus
 * le prix de rien. On génère donc de vrais en-têtes et de vraies lignes, et on saura demander
 * « quel est le prix de X ? » avec une bonne réponse connue d'avance.
 */
export async function makeXlsx(sheets: { nom: string; lignes: (string | number)[][] }[]): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.lignes), s.nom.slice(0, 31));
  }
  return zipReproductible(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
}

/**
 * UNE PRÉSENTATION .pptx RÉELLE, produite par `pptxgenjs`.
 *
 * Écrite par une bibliothèque TIERCE, et c'est délibéré : notre parseur lit `ppt/slides/slideN.xml`
 * avec ses propres hypothèses sur la façon dont PowerPoint range le texte. Si le banc fabriquait
 * lui-même ce XML, il ne vérifierait que l'accord du parseur avec sa propre convention — jamais
 * avec un vrai fichier. Un générateur indépendant est le seul qui puisse le contredire.
 */
export async function makePptx(slides: { titre: string; puces: string[]; notes?: string }[]): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const p = new PptxGenJS();
  for (const s of slides) {
    const sl = p.addSlide();
    sl.addText(s.titre, { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 24, bold: true });
    sl.addText(s.puces.map((t) => ({ text: t, options: { bullet: true } })), { x: 0.7, y: 1.5, w: 8.5, h: 4, fontSize: 16 });
    if (s.notes) sl.addNotes(s.notes);
  }
  return zipReproductible((await p.write({ outputType: "nodebuffer" })) as Buffer);
}

/** Un CSV, séparateur point-virgule — la convention des exports francophones. */
export function makeCsv(entete: string[], lignes: (string | number)[][]): Buffer {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return Buffer.from([entete, ...lignes].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n", "utf8");
}

/**
 * UNE PHOTO — du texte rendu en JPEG, sans aucune couche texte.
 *
 * C'est le cas le plus dur et le plus courant : quelqu'un photographie un courrier avec son
 * téléphone. Le code ne peut RIEN en extraire — et c'est exactement ce qui doit être vérifié.
 * Un banc qui trouverait du texte ici mesurerait autre chose qu'une photo.
 *
 * Le texte est lisible à l'œil (et par un modèle de vision) : le jour où une clé est disponible,
 * le même corpus sert à mesurer la QUALITÉ de la vision, avec une vérité connue d'avance.
 *
 * ── UNE LIMITE MESURÉE, PAS SUPPOSÉE : L'ARABE ──────────────────────────────────────────
 *
 * Le rendu passe par librsvg, dont la prise en charge bidirectionnelle est incomplète. Vérifié
 * en regardant l'image produite : les lettres arabes se LIENT correctement (le façonnage
 * marche), mais l'ordre des mots d'une ligne mêlant arabe et latin est inversé, et forcer
 * `direction="rtl"` fait déborder le texte hors du cadre au lieu de le corriger.
 *
 * Conséquence, et elle est bornée : une image arabe reste VALABLE pour ce que le corpus mesure
 * ici — aucune couche texte, donc montée obligatoire vers la vision. Elle ne l'est PAS pour
 * noter la qualité d'un modèle de vision, puisqu'on lui reprocherait de mal lire ce qui a été
 * mal écrit. Les pièces concernées portent `rendu: "ordre-non-garanti"` et le banc à clé devra
 * les écarter de sa note, ou fournir un rendu correct (une police et un moteur bidi complets).
 */
export async function makePhoto(
  lignes: string[],
  opts: { largeur?: number; hauteur?: number; qualite?: number } = {},
): Promise<{ jpeg: Buffer; largeur: number; hauteur: number }> {
  const sharp = (await import("sharp")).default;
  const largeur = opts.largeur ?? 900;
  const hauteur = opts.hauteur ?? 1200;
  const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}">`
    + `<rect width="100%" height="100%" fill="#f4f1ea"/>`
    + lignes
      .map((l, i) => `<text x="60" y="${110 + i * 46}" font-family="DejaVu Sans, sans-serif" font-size="${i === 0 ? 30 : 24}"`
        + `${i === 0 ? ' font-weight="bold"' : ""} fill="#1a1a1a">${xmlEsc(l)}</text>`)
      .join("")
    + `</svg>`;
  const jpeg = await sharp(Buffer.from(svg, "utf8")).jpeg({ quality: opts.qualite ?? 82 }).toBuffer();
  return { jpeg, largeur, hauteur };
}

/**
 * REND UNE ARCHIVE ZIP REPRODUCTIBLE — même contenu, mêmes octets, d'une exécution à l'autre.
 *
 * ── POURQUOI C'EST NÉCESSAIRE, ET COMMENT ON L'A SU ─────────────────────────────────────
 *
 * Les formats Office sont des ZIP, et un ZIP horodate chaque entrée. Deux générations du même
 * document produisent donc des octets DIFFÉRENTS, donc une empreinte différente. Constaté en
 * relançant le banc : les .docx et .pptx ressortaient « versioned » à chaque passage, comme si
 * le document avait changé — alors que rien n'avait bougé sauf l'heure.
 *
 * L'effet est double et les deux sont graves pour une mesure : le banc n'est plus idempotent
 * (chaque exécution crée une version de plus), et surtout il rapporte comme une révision ce qui
 * n'en est pas une — c'est-à-dire qu'il ment sur la propriété même qu'il est censé vérifier.
 */
export async function zipReproductible(archive: Buffer): Promise<Buffer> {
  const JSZip = (await import("jszip")).default;
  const src = await JSZip.loadAsync(archive);
  const out = new JSZip();
  // Une date fixe, arbitraire mais stable. Elle n'a aucune valeur métier : elle sert seulement
  // à ce que deux constructions du même contenu se ressemblent octet pour octet.
  const date = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
  // Le tri par nom fige aussi l'ORDRE des entrées, que rien ne garantit autrement.
  for (const chemin of Object.keys(src.files).sort()) {
    const f = src.files[chemin];
    if (!f || f.dir) continue;
    let contenu = await f.async("nodebuffer");
    // LA DATE VIT AUSSI DANS LE CONTENU, pas seulement dans l'entrée ZIP. `docProps/core.xml`
    // porte `dcterms:created` / `dcterms:modified`, que le générateur remplit à l'heure courante.
    // Figer les entrées ne suffisait donc pas : les .pptx ressortaient encore « versioned » à
    // chaque exécution — trois sur quarante-trois, assez peu pour passer pour du bruit et assez
    // pour fausser la mesure de déduplication. Constaté en relançant le banc, pas en relisant.
    if (chemin === "docProps/core.xml") {
      contenu = Buffer.from(
        contenu.toString("utf8").replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "2026-01-01T00:00:00Z"),
        "utf8",
      );
    }
    out.file(chemin, contenu, { date, createFolders: false });
  }
  return out.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
