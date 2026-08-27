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
