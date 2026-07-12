/**
 * DÉCOUPAGE PDF PAR PLAGES DE PAGES (mupdf) — pour océriser des documents massifs
 * (8 000–10 000 pages) qui dépassent les limites d'un appel OCR unique (pages/taille).
 *
 * Le document source est chargé UNE SEULE FOIS ; chaque tranche est produite en greffant
 * (`graftPage`) ses pages dans un nouveau PDF minimal, puis sérialisée en Buffer. Les objets
 * partagés sont réutilisés (greffe) → pic mémoire ≈ source + une tranche, pas N copies.
 */

export interface PdfSource {
  pageCount: number;
  /** Sérialise les pages [start, start+count) en un sous-PDF autonome (Buffer Node). */
  extractRange(start: number, count: number): Buffer;
  /** Libère la mémoire WASM du document source. À appeler impérativement (finally). */
  close(): void;
}

/**
 * Ouvre un PDF pour découpage. Lève si le buffer n'est pas un PDF exploitable (mupdf tente
 * d'abord une auto-réparation des xref imparfaits, comme pour la rastérisation).
 */
export async function openPdf(buffer: Buffer): Promise<PdfSource> {
  const mupdf = await import("mupdf");
  const doc = new mupdf.PDFDocument(new Uint8Array(buffer));
  const pageCount = doc.countPages();

  const extractRange = (start: number, count: number): Buffer => {
    const end = Math.min(start + count, pageCount);
    const dst = new mupdf.PDFDocument();
    for (let i = start; i < end; i++) dst.graftPage(-1, doc, i); // -1 = ajout en fin
    const buf = dst.saveToBuffer("garbage"); // nettoie les objets orphelins (option sûre)
    const out = Buffer.from(buf.asUint8Array());
    (buf as { destroy?: () => void }).destroy?.();
    (dst as unknown as { destroy?: () => void }).destroy?.();
    return out;
  };

  const close = () => (doc as unknown as { destroy?: () => void }).destroy?.();
  return { pageCount, extractRange, close };
}
